import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { resolveStaffPermissions } from "../auth/staff-permissions";
import { activityActor, recordActivity } from "../activity/record-activity";
import { parse, assetInput } from "./property.validation";
import { validateAssetBytes } from "./asset-bytes";
import { PropertyService } from "./property.service";

const visibility = z.enum(["Listing", "Buyer only", "Staff only"]);
const input = z
  .object({
    plotId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(80),
    visibility,
    buyerId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(5000),
    version: z.number().int().positive().optional(),
    file: assetInput.omit({ kind: true }).optional(),
  })
  .strict();
const queryInput = z
  .object({
    q: z.string().trim().max(128).optional(),
    visibility: visibility.optional(),
    plotId: z.string().uuid().optional(),
    cursor: z.string().uuid().optional(),
  })
  .strict();
const select = {
  id: true,
  plotId: true,
  name: true,
  mime: true,
  kind: true,
  category: true,
  notes: true,
  recipientId: true,
  recordVersion: true,
  fileVersion: true,
  createdAt: true,
  updatedAt: true,
  plot: { select: { code: true, title: true, publication: true } },
  recipient: { select: { id: true, name: true, email: true } },
  _count: { select: { allocations: true } },
} as const;
type Tx = Prisma.TransactionClient;
@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly property: PropertyService,
  ) {}
  private async staff(userId: string, tx: Tx = this.db) {
    const actor = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!resolveStaffPermissions(actor).includes("documents"))
      throw new ForbiddenException("You do not have access to Documents.");
    return actor;
  }
  private eligible(plotId: string): Prisma.UserWhereInput {
    return {
      staffRole: null,
      emailVerifiedAt: { not: null },
      OR: [
        {
          reservations: { some: { plotId, status: "ACTIVE", accessExpiresAt: { gt: new Date() } } },
        },
        { coRequests: { some: { plotId, status: { in: ["PROPOSED", "ACTIVE", "ALLOCATED"] } } } },
        { coAllocations: { some: { match: { plotId } } } },
      ],
    };
  }
  async plots(actorId: string, query: unknown) {
    await this.staff(actorId);
    const q = parse(queryInput, query);
    const where: Prisma.PropertyPlotWhereInput = q.q
      ? {
          OR: ["code", "title"].map((field) => ({
            [field]: { contains: q.q, mode: "insensitive" },
          })),
        }
      : {};
    const rows = await this.db.propertyPlot.findMany({
      where,
      take: 31,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, code: true, title: true, publication: true },
    });
    return { items: rows.slice(0, 30), nextCursor: rows.length > 30 ? rows[29].id : null };
  }
  async buyers(actorId: string, plotId: string, query: unknown) {
    await this.staff(actorId);
    const q = parse(queryInput, query);
    const rows = await this.db.user.findMany({
      where: {
        ...this.eligible(plotId),
        ...(q.q
          ? {
              AND: [
                {
                  OR: [
                    { name: { contains: q.q, mode: "insensitive" } },
                    { email: { contains: q.q, mode: "insensitive" } },
                  ],
                },
              ],
            }
          : {}),
      },
      take: 31,
      orderBy: { id: "asc" },
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, name: true, email: true },
    });
    return { items: rows.slice(0, 30), nextCursor: rows.length > 30 ? rows[29].id : null };
  }
  async list(actorId: string, query: unknown) {
    await this.staff(actorId);
    const q = parse(queryInput, query);
    const where: Prisma.PlotAssetWhereInput = {
      kind:
        q.visibility === "Listing"
          ? "LISTING_DOCUMENT"
          : q.visibility
            ? "PRIVATE_DOCUMENT"
            : { not: "PHOTO" },
      ...(q.visibility === "Buyer only"
        ? { recipientId: { not: null } }
        : q.visibility === "Staff only"
          ? { recipientId: null }
          : {}),
      ...(q.plotId ? { plotId: q.plotId } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { category: { contains: q.q, mode: "insensitive" } },
              { plot: { code: { contains: q.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.db.plotAsset.findMany({
        where,
        select,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 31,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      }),
      this.db.plotAsset.count({ where }),
      this.db.plotAsset.groupBy({
        by: ["kind", "recipientId"],
        where: { kind: { not: "PHOTO" } },
        _count: true,
      }),
    ]);
    return {
      items: rows.slice(0, 30),
      total,
      nextCursor: rows.length > 30 ? rows[29].id : null,
      stats: {
        total: counts.reduce((s, c) => s + c._count, 0),
        listing: counts
          .filter((c) => c.kind === "LISTING_DOCUMENT")
          .reduce((s, c) => s + c._count, 0),
        buyer: counts.filter((c) => c.recipientId !== null).reduce((s, c) => s + c._count, 0),
        staff: counts
          .filter((c) => c.kind === "PRIVATE_DOCUMENT" && c.recipientId === null)
          .reduce((s, c) => s + c._count, 0),
      },
    };
  }
  async detail(actorId: string, id: string) {
    await this.staff(actorId);
    const row = await this.db.plotAsset.findFirst({
      where: { id, kind: { not: "PHOTO" } },
      select: {
        ...select,
        versions: {
          orderBy: { number: "desc" },
          select: {
            id: true,
            number: true,
            name: true,
            mime: true,
            size: true,
            uploadedBy: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Document not found.");
    return row;
  }
  async save(actorId: string, body: unknown, id?: string) {
    const data = parse(input, body);
    const bytes = data.file ? validateAssetBytes({ ...data.file, kind: "LISTING_DOCUMENT" }) : null;
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(461992014)`;
        const actor = await this.staff(actorId, tx);
        const previous = id
          ? await tx.plotAsset.findFirst({ where: { id, kind: { not: "PHOTO" } } })
          : null;
        if (id && !previous) throw new NotFoundException("Document not found.");
        if (previous && data.version !== previous.recordVersion)
          throw new ConflictException("This document changed. Reload it before saving.");
        if (previous && previous.plotId !== data.plotId)
          throw new BadRequestException("An existing document cannot be moved to another plot.");
        if (previous && (await tx.coAllocation.count({ where: { documentId: previous.id } })))
          throw new ConflictException(
            "Allocated documents are permanent ownership records and cannot be changed here.",
          );
        if (!(await tx.propertyPlot.findUnique({ where: { id: data.plotId } })))
          throw new NotFoundException("Plot not found.");
        if (!previous && !bytes)
          throw new BadRequestException("Choose a PDF or image before uploading.");
        if (!previous && (await tx.plotAsset.count({ where: { plotId: data.plotId } })) >= 30)
          throw new BadRequestException("Keep up to 30 files per plot.");
        if (previous && bytes && previous.fileVersion >= 20)
          throw new BadRequestException("Keep up to 20 versions of each document.");
        const kind = data.visibility === "Listing" ? "LISTING_DOCUMENT" : "PRIVATE_DOCUMENT";
        const recipientId = data.visibility === "Buyer only" ? data.buyerId : null;
        if (
          data.visibility === "Buyer only" &&
          (!recipientId ||
            !(await tx.user.count({ where: { ...this.eligible(data.plotId), id: recipientId } })))
        )
          throw new BadRequestException(
            "Choose a buyer with an active reservation or co-ownership record for this plot.",
          );
        if (previous?.kind === "LISTING_DOCUMENT" && kind !== previous.kind) {
          const plot = await tx.propertyPlot.findUniqueOrThrow({ where: { id: data.plotId } });
          if (
            plot.publication === "Published" &&
            (await tx.plotAsset.count({
              where: { plotId: data.plotId, kind: "LISTING_DOCUMENT" },
            })) <= 1
          )
            throw new ConflictException(
              "Add another public listing document before making this one private.",
            );
        }
        const values = {
          name: data.name,
          category: data.category,
          kind,
          recipientId,
          notes: data.notes,
          ...(bytes ? { data: bytes, mime: data.file!.mime } : {}),
        };
        const row = previous
          ? await tx.plotAsset.update({
              where: { id },
              data: {
                ...values,
                recordVersion: { increment: 1 },
                ...(bytes ? { fileVersion: { increment: 1 } } : {}),
              },
              select,
            })
          : await tx.plotAsset.create({
              data: { ...values, plotId: data.plotId, data: bytes!, mime: data.file!.mime },
              select,
            });
        if (bytes)
          await tx.documentVersion.create({
            data: {
              assetId: row.id,
              number: row.fileVersion,
              name: data.file!.name,
              mime: data.file!.mime,
              data: bytes,
              size: bytes.length,
              uploadedBy: actor.name,
            },
          });
        if (recipientId && (previous?.recipientId !== recipientId || !!bytes))
          await tx.buyerNotification.create({
            data: {
              userId: recipientId,
              title: "A document is ready",
              body: `${row.name} for ${row.plot.code} is available in your Document vault.`,
              href: "/dashboard/documents",
            },
          });
        await recordActivity(tx, actor, {
          category: "DOCUMENTS",
          action: previous ? "Document updated" : "Document uploaded",
          targetId: row.id,
          targetLabel: row.plot.code,
          detail: `${row.name} · ${data.visibility} · file v${row.fileVersion}`,
        });
        return row;
      },
      { timeout: 30000 },
    );
  }
  async download(actorId: string, id: string, version?: number) {
    await this.staff(actorId);
    await this.detail(actorId, id);
    if (!version) return this.property.asset(id, "admin");
    const row = await this.db.documentVersion.findUnique({
      where: { assetId_number: { assetId: id, number: version } },
    });
    if (!row) throw new NotFoundException("Document version not found.");
    return row;
  }
  async remove(actorId: string, id: string) {
    await this.staff(actorId);
    await this.detail(actorId, id);
    return this.property.removeAsset(actorId, id, "documents");
  }
  async buyerList(userId: string, query: unknown) {
    const q = parse(queryInput, query);
    const where = { recipientId: userId, kind: "PRIVATE_DOCUMENT" };
    const rows = await this.db.plotAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        category: true,
        mime: true,
        fileVersion: true,
        createdAt: true,
        updatedAt: true,
        plot: { select: { code: true, title: true } },
      },
    });
    return {
      items: rows.slice(0, 30),
      total: await this.db.plotAsset.count({ where }),
      nextCursor: rows.length > 30 ? rows[29].id : null,
    };
  }
}
