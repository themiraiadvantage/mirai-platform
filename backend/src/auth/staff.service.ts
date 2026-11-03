import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { PrismaService } from "../database/prisma.service";
import { MailService } from "../mail/mail.service";
import { tokenHash, safeUserSelect } from "./auth.service";
import { InviteStaffDto, StaffPermissionsDto } from "./staff.dto";
import { resolveStaffPermissions } from "./staff-permissions";
import type { Prisma } from "../generated/prisma/client";
import { recordActivity } from "../activity/record-activity";

const invitationSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  permissions: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
} as const;
const invalid = () =>
  new BadRequestException(
    "This invitation is invalid, expired or already used. Ask the platform owner for a new invitation.",
  );

@Injectable()
export class StaffService {
  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
  ) {}
  private async owner(tx: Prisma.TransactionClient, id: string) {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user?.staffActive || user.staffRole !== "SUPER_ADMIN")
      throw new ForbiddenException("Only an active Super Admin can manage staff.");
    return user;
  }
  async list(ownerId: string) {
    return this.db.$transaction(async (tx) => {
      await this.owner(tx, ownerId);
      return {
        members: await tx.user.findMany({
          where: { staffRole: { not: null } },
          select: safeUserSelect,
          orderBy: { createdAt: "asc" },
        }),
        invitations: await tx.staffInvitation.findMany({
          where: { acceptedAt: null },
          select: invitationSelect,
          orderBy: { createdAt: "desc" },
        }),
      };
    });
  }
  async invite(input: InviteStaffDto, invitedById: string | null) {
    const token = randomBytes(32).toString("hex");
    await this.db.$transaction(async (tx) => {
      // Serialize grants, revocations and first-owner setup across processes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(716294013)`;
      const actor = invitedById ? await this.owner(tx, invitedById) : null;
      if (!invitedById) {
        if (
          input.role !== "SUPER_ADMIN" ||
          (await tx.user.count({ where: { staffRole: { not: null } } }))
        )
          throw new BadRequestException(
            "An owner already exists. Use Staff access in the admin dashboard.",
          );
        if (
          await tx.staffInvitation.findFirst({
            where: { invitedById: null, email: { not: input.email }, acceptedAt: null },
          })
        )
          throw new BadRequestException(
            "An owner setup invitation already exists for another email.",
          );
      }
      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing?.staffRole)
        throw new BadRequestException(
          "This person already has a staff account. Manage their access below.",
        );
      const previous = await tx.staffInvitation.findUnique({ where: { email: input.email } });
      if (previous && previous.createdAt.getTime() > Date.now() - 60000)
        throw new BadRequestException(
          "An invitation was just sent. Please wait a minute before resending.",
        );
      const data = {
        name: input.name,
        role: input.role,
        permissions:
          input.role === "SUPER_ADMIN"
            ? []
            : resolveStaffPermissions({
                staffRole: input.role,
                staffActive: true,
                staffPermissions: input.permissions || [],
              }),
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
        createdAt: new Date(),
        invitedById,
      };
      const invitation = await tx.staffInvitation.upsert({
        where: { email: input.email },
        create: { email: input.email, ...data },
        update: data,
      });
      await recordActivity(tx, actor, {
        category: "STAFF",
        action: previous ? "Staff invitation renewed" : "Staff invitation created",
        targetId: invitation.id,
        targetLabel: input.email,
        detail: `Invitation prepared for ${input.name} with role ${input.role}.`,
      });
    });
    try {
      await this.mail.sendStaffInvitation(input.email, input.name, input.role, token, !invitedById);
    } catch (error) {
      await this.db.staffInvitation.updateMany({
        where: { tokenHash: tokenHash(token), acceptedAt: null },
        data: { expiresAt: new Date(0), createdAt: new Date(0) },
      });
      throw error;
    }
    return {
      message: "Invitation sent. The recipient can set their own password using the email link.",
    };
  }
  private async validInvitation(tx: Prisma.TransactionClient, token: string) {
    const invitation = await tx.staffInvitation.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now())
      throw invalid();
    if (invitation.invitedById) await this.owner(tx, invitation.invitedById);
    else if (await tx.user.count({ where: { staffRole: { not: null } } })) throw invalid();
    return invitation;
  }
  async inspect(token: string) {
    return this.db.$transaction(async (tx) => {
      const { name, email, role, permissions, expiresAt } = await this.validInvitation(tx, token);
      return { name, email, role, permissions, expiresAt };
    });
  }
  async accept(token: string, password: string) {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(716294013)`;
      const invitation = await this.validInvitation(tx, token);
      const existing = await tx.user.findUnique({ where: { email: invitation.email } });
      if (existing?.staffRole) throw invalid();
      const consumed = await tx.staffInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (consumed.count !== 1) throw invalid();
      const data = {
        passwordHash,
        staffRole: invitation.role,
        staffPermissions: invitation.permissions,
        staffActive: true,
        emailVerifiedAt: new Date(),
      };
      const user = await tx.user.upsert({
        where: { email: invitation.email },
        create: { email: invitation.email, name: invitation.name, ...data },
        update: data,
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.emailVerification.deleteMany({ where: { userId: user.id } });
      await recordActivity(tx, user, {
        category: "STAFF",
        action: "Staff invitation accepted",
        targetId: user.id,
        targetLabel: user.name,
        detail: `Admin account activated with role ${invitation.role}.`,
      });
    });
    return { message: "Your password is set. Sign in to MIRAI Admin to continue." };
  }
  async setPermissions(ownerId: string, id: string, input: StaffPermissionsDto) {
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(716294013)`;
      const actor = await this.owner(tx, ownerId);
      const target = await tx.user.findUnique({ where: { id } });
      if (!target?.staffRole) throw new BadRequestException("Staff account not found.");
      if (id === ownerId)
        throw new BadRequestException("You cannot change your own role or permissions.");
      if (
        target.staffRole === "SUPER_ADMIN" &&
        target.staffActive &&
        input.role !== "SUPER_ADMIN" &&
        (await tx.user.count({ where: { staffRole: "SUPER_ADMIN", staffActive: true } })) <= 1
      )
        throw new BadRequestException("At least one Super Admin must remain active.");
      const permissions =
        input.role === "SUPER_ADMIN"
          ? []
          : resolveStaffPermissions({
              staffRole: input.role,
              staffActive: true,
              staffPermissions: input.permissions || [],
            });
      await tx.user.update({
        where: { id },
        data: { staffRole: input.role, staffPermissions: permissions },
      });
      if (
        target.staffRole !== input.role ||
        JSON.stringify(target.staffPermissions) !== JSON.stringify(permissions)
      )
        await recordActivity(tx, actor, {
          category: "STAFF",
          action: "Staff permissions updated",
          targetId: id,
          targetLabel: target.name,
          detail: "Role and section permissions updated.",
          changes: {
            role: { before: target.staffRole, after: input.role },
            permissions: { before: target.staffPermissions, after: permissions },
          },
        });
    });
    return { message: "Role and permissions updated." };
  }
  async setActive(ownerId: string, id: string, active: boolean) {
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(716294013)`;
      const actor = await this.owner(tx, ownerId);
      const target = await tx.user.findUnique({ where: { id } });
      if (!target?.staffRole) throw new BadRequestException("Staff account not found.");
      if (id === ownerId) throw new BadRequestException("You cannot change your own access.");
      if (
        !active &&
        target.staffActive &&
        target.staffRole === "SUPER_ADMIN" &&
        (await tx.user.count({ where: { staffRole: "SUPER_ADMIN", staffActive: true } })) <= 1
      )
        throw new BadRequestException("At least one Super Admin must remain active.");
      await tx.user.update({ where: { id }, data: { staffActive: active } });
      if (!active)
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      if (target.staffActive !== active)
        await recordActivity(tx, actor, {
          category: "STAFF",
          action: active ? "Staff access restored" : "Staff access suspended",
          targetId: id,
          targetLabel: target.name,
          detail: active
            ? "Admin access restored."
            : "Admin access suspended and active sessions revoked.",
          changes: { active: { before: target.staffActive, after: active } },
        });
    });
    return {
      message: active
        ? "Admin access restored."
        : "Admin access suspended and sessions signed out.",
    };
  }
}
