import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { resolveStaffPermissions } from "./staff-permissions";
import { WorkspaceSettingsDto } from "./settings.dto";
import { recordActivity } from "../activity/record-activity";

const select = {
  company: true,
  email: true,
  phone: true,
  reservationFee: true,
  accessMonths: true,
} as const;

@Injectable()
export class WorkspaceSettingsService {
  constructor(private readonly db: PrismaService) {}

  async get() {
    return this.db.workspaceSettings.upsert({
      where: { id: "platform" },
      create: { id: "platform" },
      update: {},
      select,
    });
  }

  async save(userId: string, input: WorkspaceSettingsDto) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(716294014)`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || !resolveStaffPermissions(user).includes("settings"))
        throw new ForbiddenException("You do not have access to workspace settings.");
      if (
        user.staffRole !== "SUPER_ADMIN" &&
        (input.reservationFee !== undefined || input.accessMonths !== undefined)
      )
        throw new ForbiddenException("Only the Super Admin can change listing defaults.");
      const data = {
        company: input.company,
        email: input.email,
        phone: input.phone,
        ...(input.reservationFee !== undefined ? { reservationFee: input.reservationFee } : {}),
        ...(input.accessMonths !== undefined ? { accessMonths: input.accessMonths } : {}),
      };
      const before = await tx.workspaceSettings.findUnique({ where: { id: "platform" }, select });
      const saved = await tx.workspaceSettings.upsert({
        where: { id: "platform" },
        create: { id: "platform", ...data },
        update: data,
        select,
      });
      const changes: Record<string, { before: string | number | null; after: string | number }> =
        {};
      for (const key of Object.keys(select) as (keyof typeof select)[]) {
        if (before?.[key] !== saved[key])
          changes[key] = { before: before?.[key] ?? null, after: saved[key] };
      }
      if (Object.keys(changes).length)
        await recordActivity(tx, user, {
          category: "SETTINGS",
          action: "Workspace settings updated",
          targetId: "platform",
          targetLabel: saved.company,
          detail: `Updated ${Object.keys(changes).join(", ")}.`,
          changes,
        });
      return saved;
    });
  }
}
