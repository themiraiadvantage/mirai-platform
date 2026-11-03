import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { resolveStaffPermissions } from "../auth/staff-permissions";
import { recordActivity } from "../activity/record-activity";
import { parse } from "./property.validation";

const profileInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((s) => !s || /^[+0-9 ()-]{7,30}$/.test(s), "Enter a valid phone number."),
    location: z.string().trim().max(160),
    version: z.number().int().min(0),
  })
  .strict();
const adminInput = profileInput.extend({ notes: z.string().trim().max(5000) }).strict();
const pageInput = z
  .object({
    q: z.string().trim().max(128).optional(),
    cursor: z.string().uuid().optional(),
    filter: z.enum(["verified", "unverified", "reserved", "co-ownership", "allocated"]).optional(),
  })
  .strict();
const sectionInput = z
  .object({
    section: z.enum(["reservations", "payments", "contributions", "co-ownership", "documents"]),
    cursor: z.string().uuid().optional(),
  })
  .strict();
const userSelect = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  createdAt: true,
  buyerProfile: true,
} as const;
const plotSelect = { code: true, title: true, location: true, state: true, size: true } as const;
const activeReservation = () => ({ status: "ACTIVE", accessExpiresAt: { gt: new Date() } });
type Tx = Prisma.TransactionClient;
@Injectable()
export class BuyersService {
  constructor(private readonly db: PrismaService) {}
  private async access(actorId: string, tx: Tx = this.db) {
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    const permissions = resolveStaffPermissions(actor);
    if (!permissions.includes("customers"))
      throw new ForbiddenException("You do not have access to Buyers & ownership.");
    return {
      actor,
      flags: {
        payments: permissions.includes("payments"),
        documents: permissions.includes("documents"),
        reservations: permissions.includes("reservations"),
        coOwnership: permissions.includes("co-ownership"),
        plots: permissions.includes("plots"),
      },
    };
  }
  private async customer(id: string, tx: Tx = this.db) {
    const row = await tx.user.findFirst({ where: { id, staffRole: null }, select: userSelect });
    if (!row) throw new NotFoundException("Customer account not found.");
    return row;
  }
  private present(row: Prisma.UserGetPayload<{ select: typeof userSelect }>, admin: boolean) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      verified: !!row.emailVerifiedAt,
      joinedAt: row.createdAt,
      phone: row.buyerProfile?.phone || "",
      location: row.buyerProfile?.location || "",
      version: row.buyerProfile?.version || 0,
      ...(admin ? { notes: row.buyerProfile?.notes || "" } : {}),
    };
  }
  private async paid(ids: string[]) {
    if (!ids.length) return new Map<string, { fees: number; contributions: number }>();
    const [fees, contributions] = await Promise.all([
      this.db.reservationPayment.findMany({
        where: { status: "SUCCESS", reservation: { userId: { in: ids } } },
        select: { amountKobo: true, reservation: { select: { userId: true } } },
      }),
      this.db.coContribution.findMany({
        where: { request: { userId: { in: ids } } },
        select: { amount: true, request: { select: { userId: true } } },
      }),
    ]);
    const amounts = new Map(ids.map((id) => [id, { fees: 0, contributions: 0 }]));
    for (const row of fees)
      amounts.get(row.reservation.userId)!.fees += Number(row.amountKobo) / 100;
    for (const row of contributions)
      amounts.get(row.request.userId)!.contributions += Number(row.amount);
    return amounts;
  }
  async list(actorId: string, query: unknown) {
    const { flags } = await this.access(actorId);
    const q = parse(pageInput, query);
    const where: Prisma.UserWhereInput = {
      staffRole: null,
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { email: { contains: q.q, mode: "insensitive" } },
              { buyerProfile: { phone: { contains: q.q } } },
            ],
          }
        : {}),
      ...(q.filter === "verified"
        ? { emailVerifiedAt: { not: null } }
        : q.filter === "unverified"
          ? { emailVerifiedAt: null }
          : q.filter === "reserved"
            ? { reservations: { some: activeReservation() } }
            : q.filter === "co-ownership"
              ? { coRequests: { some: { status: { in: ["PROPOSED", "ACTIVE", "ALLOCATED"] } } } }
              : q.filter === "allocated"
                ? { coAllocations: { some: {} } }
                : {}),
    };
    const [rows, total, registered, verified, reserved, allocated] = await Promise.all([
      this.db.user.findMany({
        where,
        select: {
          ...userSelect,
          _count: {
            select: {
              reservations: { where: activeReservation() },
              coRequests: { where: { status: { in: ["PROPOSED", "ACTIVE", "ALLOCATED"] } } },
              coAllocations: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 31,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      }),
      this.db.user.count({ where }),
      this.db.user.count({ where: { staffRole: null } }),
      this.db.user.count({ where: { staffRole: null, emailVerifiedAt: { not: null } } }),
      this.db.user.count({
        where: { staffRole: null, reservations: { some: activeReservation() } },
      }),
      this.db.user.count({ where: { staffRole: null, coAllocations: { some: {} } } }),
    ]);
    const amounts = flags.payments ? await this.paid(rows.slice(0, 30).map((r) => r.id)) : null;
    return {
      items: rows
        .slice(0, 30)
        .map((r) => ({
          ...this.present(r, true),
          activeReservations: r._count.reservations,
          partnerships: r._count.coRequests,
          allocations: r._count.coAllocations,
          confirmed: amounts
            ? (amounts.get(r.id)?.fees || 0) + (amounts.get(r.id)?.contributions || 0)
            : null,
        })),
      total,
      nextCursor: rows.length > 30 ? rows[29].id : null,
      stats: { registered, verified, reserved, allocated },
      access: flags,
    };
  }
  async detail(actorId: string, id: string) {
    const { flags } = await this.access(actorId);
    const row = await this.customer(id);
    const [reservations, requests, allocated, amounts, documents] = await Promise.all([
      this.db.plotReservation.count({ where: { userId: id, ...activeReservation() } }),
      this.db.coRequest.count({
        where: { userId: id, status: { in: ["PROPOSED", "ACTIVE", "ALLOCATED"] } },
      }),
      this.db.coAllocation.count({ where: { userId: id } }),
      flags.payments ? this.paid([id]) : Promise.resolve(null),
      flags.documents
        ? this.db.plotAsset.count({
            where: {
              kind: "PRIVATE_DOCUMENT",
              OR: [{ recipientId: id }, { allocations: { some: { userId: id } } }],
            },
          })
        : Promise.resolve(null),
    ]);
    return {
      ...this.present(row, true),
      activeReservations: reservations,
      partnerships: requests,
      allocations: allocated,
      confirmedFees: amounts?.get(id)?.fees ?? null,
      confirmedContributions: amounts?.get(id)?.contributions ?? null,
      documents,
      access: flags,
    };
  }
  async records(actorId: string, id: string, query: unknown) {
    const { flags } = await this.access(actorId);
    await this.customer(id);
    const q = parse(sectionInput, query);
    const permitted =
      q.section === "payments" || q.section === "contributions"
        ? flags.payments
        : q.section === "co-ownership"
          ? flags.coOwnership
          : q.section === "documents"
            ? flags.documents
            : flags.reservations;
    if (!permitted) throw new ForbiddenException("You do not have access to these records.");
    const page = { take: 31, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) };
    if (q.section === "reservations") {
      const where = { userId: id };
      const rows = await this.db.plotReservation.findMany({
        where,
        ...page,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          status: true,
          amountKobo: flags.payments,
          createdAt: true,
          accessExpiresAt: true,
          plot: { select: plotSelect },
        },
      });
      return {
        items: rows
          .slice(0, 30)
          .map((r) => ({
            id: r.id,
            plot: r.plot,
            status: r.status,
            date: r.createdAt,
            accessExpiresAt: r.accessExpiresAt,
            amount: flags.payments ? Number(r.amountKobo) / 100 : null,
          })),
        total: await this.db.plotReservation.count({ where }),
        nextCursor: rows.length > 30 ? rows[29].id : null,
      };
    }
    if (q.section === "payments") {
      const where = { reservation: { userId: id } };
      const rows = await this.db.reservationPayment.findMany({
        where,
        ...page,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          status: true,
          amountKobo: true,
          paidAt: true,
          createdAt: true,
          reservation: { select: { plot: { select: plotSelect } } },
        },
      });
      return {
        items: rows
          .slice(0, 30)
          .map((r) => ({
            id: r.id,
            plot: r.reservation.plot,
            status: r.status,
            date: r.paidAt || r.createdAt,
            amount: Number(r.amountKobo) / 100,
          })),
        total: await this.db.reservationPayment.count({ where }),
        nextCursor: rows.length > 30 ? rows[29].id : null,
      };
    }
    if (q.section === "contributions") {
      const where = { request: { userId: id } };
      const rows = await this.db.coContribution.findMany({
        where,
        ...page,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          amount: true,
          receivedAt: true,
          request: { select: { plot: { select: plotSelect } } },
        },
      });
      return {
        items: rows
          .slice(0, 30)
          .map((r) => ({
            id: r.id,
            plot: r.request.plot,
            status: "SUCCESS",
            date: r.receivedAt,
            amount: Number(r.amount),
          })),
        total: await this.db.coContribution.count({ where }),
        nextCursor: rows.length > 30 ? rows[29].id : null,
      };
    }
    if (q.section === "co-ownership") {
      const where = { userId: id };
      const rows = await this.db.coRequest.findMany({
        where,
        ...page,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, status: true, createdAt: true, plot: { select: plotSelect } },
      });
      return {
        items: rows
          .slice(0, 30)
          .map((r) => ({
            id: r.id,
            plot: r.plot,
            status: r.status,
            date: r.createdAt,
            amount: null,
          })),
        total: await this.db.coRequest.count({ where }),
        nextCursor: rows.length > 30 ? rows[29].id : null,
      };
    }
    const where = {
      kind: "PRIVATE_DOCUMENT",
      OR: [{ recipientId: id }, { allocations: { some: { userId: id } } }],
    };
    const rows = await this.db.plotAsset.findMany({
      where,
      ...page,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        category: true,
        fileVersion: true,
        createdAt: true,
        plot: { select: plotSelect },
      },
    });
    return {
      items: rows
        .slice(0, 30)
        .map((r) => ({ ...r, date: r.createdAt, amount: null, status: "AVAILABLE" })),
      total: await this.db.plotAsset.count({ where }),
      nextCursor: rows.length > 30 ? rows[29].id : null,
    };
  }
  async profile(id: string) {
    return this.present(await this.customer(id), false);
  }
  async save(actorId: string, id: string, body: unknown, admin = true) {
    const data = parse(admin ? adminInput : profileInput, body);
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(461992014)`;
        const actor = admin
          ? (await this.access(actorId, tx)).actor
          : await tx.user.findUniqueOrThrow({ where: { id: actorId } });
        if (!admin && (actorId !== id || actor.staffRole || !actor.emailVerifiedAt))
          throw new ForbiddenException();
        const previous = await this.customer(id, tx);
        if ((previous.buyerProfile?.version || 0) !== data.version)
          throw new ConflictException("This profile changed. Reload it before saving.");
        const notes = "notes" in data ? (data.notes as string) : previous.buyerProfile?.notes || "";
        await tx.user.update({ where: { id }, data: { name: data.name } });
        await tx.buyerProfile.upsert({
          where: { userId: id },
          create: { userId: id, phone: data.phone, location: data.location, notes },
          update: { phone: data.phone, location: data.location, notes, version: { increment: 1 } },
        });
        await recordActivity(tx, actor, {
          category: "BUYERS",
          action: admin ? "Buyer details updated" : "Profile updated",
          targetId: id,
          targetLabel: data.name,
          detail: admin
            ? "Contact details or staff notes updated."
            : "Customer updated their profile.",
        });
        return this.present(await this.customer(id, tx), admin);
      },
      { timeout: 30000 },
    );
  }
}
