import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { AnnouncementDto } from "./announcements.dto";
import type { Prisma } from "../generated/prisma/client";
import { activityActor, recordActivity } from "../activity/record-activity";

const eligibleBuyer = { staffRole: null, emailVerifiedAt: { not: null } } as const;
const buyerSelect = { id: true, name: true, email: true } as const;
const notificationSelect = {
  id: true,
  createdAt: true,
  readAt: true,
  title: true,
  body: true,
  href: true,
  announcement: { select: { id: true, title: true, body: true, publishedAt: true } },
} as const;
function inboxItem(item: {
  id: string;
  title: string | null;
  body: string | null;
  href: string | null;
  createdAt: Date;
  readAt: Date | null;
  announcement: { id: string; title: string; body: string; publishedAt: Date | null } | null;
}) {
  const paymentCopy = (value: string) =>
    value
      .replace(
        /^Test (reservation|payment)/,
        (_, word: string) => word[0].toUpperCase() + word.slice(1),
      )
      .replace(" test payment confirmed.", " payment confirmed.");
  const payment = !item.announcement && item.href === "/dashboard/payments";
  return {
    ...item,
    kind: item.announcement ? "announcement" : "activity",
    announcement: item.announcement ?? {
      id: item.id,
      title: payment
        ? paymentCopy(item.title ?? "Payment update")
        : (item.title ?? "Ownership update"),
      body: payment ? paymentCopy(item.body ?? "") : (item.body ?? ""),
      publishedAt: item.createdAt,
    },
  };
}

@Injectable()
export class AnnouncementsService {
  constructor(private readonly db: PrismaService) {}

  async buyers(q = "") {
    const where = {
      ...eligibleBuyer,
      ...(q.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: "insensitive" as const } },
              { email: { contains: q.trim(), mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        select: buyerSelect,
        take: 50,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total };
  }

  async list(cursor?: string, status?: "DRAFT" | "PUBLISHED") {
    const [rows, drafts, published, delivered] = await Promise.all([
      this.db.announcement.findMany({
        where: status ? { status } : {},
        take: 21,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          author: { select: { name: true } },
          _count: { select: { notifications: true } },
        },
      }),
      this.db.announcement.count({ where: { status: "DRAFT" } }),
      this.db.announcement.count({ where: { status: "PUBLISHED" } }),
      this.db.buyerNotification.count({ where: { announcementId: { not: null } } }),
    ]);
    const page = rows.slice(0, 20);
    const ids = page.map((row) => row.id);
    const [readCounts, selectedBuyers] = await Promise.all([
      this.db.buyerNotification.groupBy({
        by: ["announcementId"],
        where: { announcementId: { in: ids }, readAt: { not: null } },
        _count: { _all: true },
      }),
      this.db.user.findMany({
        where: { id: { in: [...new Set(page.flatMap((row) => row.buyerIds))] } },
        select: buyerSelect,
      }),
    ]);
    return {
      items: page.map(({ _count, ...row }) => ({
        ...row,
        recipientCount: _count.notifications,
        readCount: readCounts.find((count) => count.announcementId === row.id)?._count._all ?? 0,
        selectedBuyers: selectedBuyers.filter((buyer) => row.buyerIds.includes(buyer.id)),
      })),
      nextCursor: rows.length > 20 ? page.at(-1)!.id : null,
      stats: { drafts, published, delivered },
    };
  }

  private async audience(tx: Prisma.TransactionClient, input: AnnouncementDto) {
    if (input.audience === "ALL_BUYERS") {
      if (input.buyerIds.length)
        throw new BadRequestException(
          "All-buyers announcements must not specify individual recipients.",
        );
      return;
    }
    if (!input.buyerIds.length) throw new BadRequestException("Choose at least one buyer.");
    const count = await tx.user.count({ where: { ...eligibleBuyer, id: { in: input.buyerIds } } });
    if (count !== input.buyerIds.length)
      throw new BadRequestException("Choose verified buyer accounts from the recipient list.");
  }

  async create(authorId: string, input: AnnouncementDto) {
    return this.db.$transaction(async (tx) => {
      await this.audience(tx, input);
      const saved = await tx.announcement.create({
        data: {
          title: input.title,
          body: input.body,
          audience: input.audience,
          buyerIds: input.buyerIds,
          authorId,
        },
      });
      await recordActivity(tx, await activityActor(tx, authorId), {
        category: "ANNOUNCEMENTS",
        action: "Announcement drafted",
        targetId: saved.id,
        targetLabel: saved.title,
        detail:
          saved.audience === "ALL_BUYERS"
            ? "Draft prepared for all buyers."
            : `Draft prepared for ${saved.buyerIds.length} selected buyers.`,
      });
      return saved;
    });
  }

  async update(id: string, input: AnnouncementDto, actorId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(581924, hashtext(${id}))`;
      const row = await tx.announcement.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("Announcement not found.");
      if (row.status !== "DRAFT")
        throw new ConflictException(
          "Published announcements cannot be edited. Create a new announcement for a correction.",
        );
      await this.audience(tx, input);
      const saved = await tx.announcement.update({
        where: { id },
        data: {
          title: input.title,
          body: input.body,
          audience: input.audience,
          buyerIds: input.buyerIds,
        },
      });
      const changed = ["title", "body", "audience", "buyerIds"].filter(
        (key) =>
          JSON.stringify(row[key as keyof typeof row]) !==
          JSON.stringify(saved[key as keyof typeof saved]),
      );
      if (changed.length)
        await recordActivity(tx, await activityActor(tx, actorId), {
          category: "ANNOUNCEMENTS",
          action: "Announcement draft updated",
          targetId: id,
          targetLabel: saved.title,
          detail: `Updated ${changed.map((key) => (key === "body" ? "message" : key === "buyerIds" ? "recipients" : key)).join(", ")}.`,
        });
      return saved;
    });
  }

  async publish(id: string, actorId: string) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(581924, hashtext(${id}))`;
        const row = await tx.announcement.findUnique({ where: { id } });
        if (!row) throw new NotFoundException("Announcement not found.");
        if (row.status === "PUBLISHED") return row;
        const recipients = await tx.user.findMany({
          where: {
            ...eligibleBuyer,
            ...(row.audience === "SELECTED_BUYERS" ? { id: { in: row.buyerIds } } : {}),
          },
          select: { id: true },
        });
        if (!recipients.length)
          throw new BadRequestException(
            "There are no eligible buyers to receive this announcement.",
          );
        if (row.audience === "SELECTED_BUYERS" && recipients.length !== row.buyerIds.length)
          throw new BadRequestException(
            "Some selected buyers are no longer eligible. Update the draft audience first.",
          );
        const publishedAt = new Date();
        const published = await tx.announcement.update({
          where: { id },
          data: { status: "PUBLISHED", publishedAt },
        });
        await tx.buyerNotification.createMany({
          data: recipients.map((user) => ({
            id: randomUUID(),
            userId: user.id,
            announcementId: id,
            createdAt: publishedAt,
          })),
          skipDuplicates: true,
        });
        await recordActivity(tx, await activityActor(tx, actorId), {
          category: "ANNOUNCEMENTS",
          action: "Announcement published",
          targetId: id,
          targetLabel: row.title,
          detail: `Delivered ${recipients.length} in-app notifications to ${row.audience === "ALL_BUYERS" ? "all eligible buyers" : "selected buyers"}.`,
        });
        return published;
      },
      { timeout: 30000 },
    );
  }

  async inbox(userId: string, cursor?: string) {
    if (
      cursor &&
      !(await this.db.buyerNotification.findFirst({
        where: { id: cursor, userId },
        select: { id: true },
      }))
    )
      throw new BadRequestException("Invalid notification cursor.");
    const [rows, unreadCount] = await Promise.all([
      this.db.buyerNotification.findMany({
        where: { userId },
        select: notificationSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.db.buyerNotification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      items: rows.slice(0, 20).map(inboxItem),
      unreadCount,
      nextCursor: rows.length > 20 ? rows[19].id : null,
    };
  }

  async read(userId: string, id: string) {
    await this.db.buyerNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    const notification = await this.db.buyerNotification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });
    if (!notification) throw new NotFoundException("Notification not found.");
    return {
      notification: inboxItem(notification),
      unreadCount: await this.db.buyerNotification.count({ where: { userId, readAt: null } }),
    };
  }

  async readAll(userId: string) {
    await this.db.buyerNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return {
      unreadCount: await this.db.buyerNotification.count({ where: { userId, readAt: null } }),
    };
  }
}
