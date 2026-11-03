import type { Prisma } from "../generated/prisma/client";

export type ActivityActor = { id: string; name: string; staffRole: string | null };
export type ActivityInput = {
  category:
    | "AUTH"
    | "STAFF"
    | "SETTINGS"
    | "ANNOUNCEMENTS"
    | "PLOTS"
    | "CO_OWNERSHIP"
    | "PAYMENTS"
    | "DOCUMENTS"
    | "BUYERS";
  action: string;
  targetId?: string;
  targetLabel: string;
  detail: string;
  changes?: Prisma.InputJsonObject;
};

// Only explicit, non-secret fields reach the log. Domain writes and their events
// commit together; no client-supplied actor or timestamp is accepted.
export function recordActivity(
  tx: Prisma.TransactionClient,
  actor: ActivityActor | null,
  input: ActivityInput,
) {
  return tx.activityEvent.create({
    data: {
      ...input,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? "System",
      actorRole: actor ? (actor.staffRole ?? "BUYER") : "SYSTEM",
      createdAt: new Date(),
    },
  });
}

export async function activityActor(tx: Prisma.TransactionClient, id: string) {
  return tx.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, staffRole: true },
  });
}
