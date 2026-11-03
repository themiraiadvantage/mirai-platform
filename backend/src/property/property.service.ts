import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { activityActor, recordActivity } from "../activity/record-activity";
import { resolveStaffPermissions } from "../auth/staff-permissions";
import * as v from "./property.validation";
import { CloudinaryService } from "./cloudinary.service";
import { validateAssetBytes } from "./asset-bytes";
import { publicationChecklist } from "./publication-checklist";

const userSelect = { id: true, name: true, email: true } as const;
const assetSelect = { id: true, name: true, mime: true, kind: true, createdAt: true } as const;
const plotInclude = {
  assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.PropertyPlotInclude;
const requestInclude = {
  user: { select: userSelect },
  plot: { include: plotInclude },
  policy: true,
  contributions: true,
} as const;
type Tx = Prisma.TransactionClient;
type Page = { cursor?: string; q?: string; status?: string };

@Injectable()
export class PropertyService {
  constructor(
    private readonly db: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}
  private async write<T>(actorId: string, section: string | null, work: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(
      async (tx) => {
        // One short domain lock serializes offers, proposals, accepts and payments.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(461992014)`;
        const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
        if (section && !resolveStaffPermissions(actor).includes(section))
          throw new ForbiddenException("This section is not available to your account.");
        if (!section && (actor.staffRole || !actor.emailVerifiedAt))
          throw new ForbiddenException("Use a verified buyer account to start co-ownership.");
        return work(tx);
      },
      { timeout: 30000 },
    );
  }
  private event(
    tx: Tx,
    actorId: string,
    category: "PLOTS" | "CO_OWNERSHIP" | "DOCUMENTS",
    action: string,
    targetId: string,
    targetLabel: string,
    detail: string,
  ) {
    return activityActor(tx, actorId).then((actor) =>
      recordActivity(tx, actor, { category, action, targetId, targetLabel, detail }),
    );
  }
  private async notify(tx: Tx, userIds: string[], title: string, body: string) {
    await tx.buyerNotification.createMany({
      data: userIds.map((userId) => ({ userId, title, body, href: "/dashboard/co-own" })),
    });
  }
  async plots(query: Page, admin = false) {
    if (query.status && !["Draft", "Published", "Archived"].includes(query.status))
      throw new BadRequestException("Invalid publication filter.");
    const where: Prisma.PropertyPlotWhereInput = {
      publication: admin ? query.status : "Published",
      ...(query.q
        ? {
            OR: ["code", "title", "location", "state"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" },
            })),
          }
        : {}),
    };
    const rows = await this.db.propertyPlot.findMany({
      where,
      include: plotInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, 30).map((p) => this.visiblePlot(p, admin));
    const counts = admin
      ? await this.db.propertyPlot.groupBy({ by: ["publication"], _count: true })
      : [];
    return {
      items,
      nextCursor: rows.length > 30 ? rows[29].id : null,
      total: await this.db.propertyPlot.count({ where }),
      ...(admin
        ? {
            stats: {
              total: counts.reduce((sum, c) => sum + c._count, 0),
              published: counts.find((c) => c.publication === "Published")?._count ?? 0,
              drafts: counts.find((c) => c.publication === "Draft")?._count ?? 0,
            },
          }
        : {}),
    };
  }
  private visiblePlot<T extends { details: Prisma.JsonValue; assets: { kind: string }[] }>(
    p: T,
    admin: boolean,
  ) {
    if (admin) return p;
    const details = { ...(p.details as Record<string, unknown>) };
    delete details.notes;
    return { ...p, details, assets: p.assets.filter((a) => a.kind !== "PRIVATE_DOCUMENT") };
  }
  async plot(code: string, admin = false) {
    const p = await this.db.propertyPlot.findFirst({
      where: { code, ...(!admin ? { publication: "Published" } : {}) },
      include: plotInclude,
    });
    if (!p) throw new NotFoundException("Plot not found.");
    return this.visiblePlot(p, admin);
  }
  async savePlot(actorId: string, input: unknown, id?: string) {
    const data = v.parse(v.plotInput, input);
    return this.write(actorId, "plots", async (tx) => {
      const previous = id ? await tx.propertyPlot.findUnique({ where: { id } }) : null;
      if (id && !previous) throw new NotFoundException("Plot not found.");
      if (previous && data.version !== previous.version)
        throw new ConflictException("This listing changed. Reload it before saving.");
      if (previous && data.code !== previous.code)
        throw new BadRequestException("The plot code cannot change after creation.");
      if (
        previous &&
        (data.availability !== previous.availability ||
          data.publication !== previous.publication) &&
        (await tx.plotReservation.count({
          where: {
            plotId: previous.id,
            OR: [
              { status: "ACTIVE" },
              { status: "PENDING", checkoutExpiresAt: { gt: new Date() } },
            ],
          },
        }))
      )
        throw new ConflictException(
          "This plot has a reservation or an open checkout. Resolve it before changing availability or publication.",
        );
      const duplicate = await tx.propertyPlot.findFirst({
        where: { code: data.code, ...(id ? { id: { not: id } } : {}) },
      });
      if (duplicate) throw new ConflictException("This plot code already exists.");
      const committed =
        id &&
        (await tx.coMatch.findFirst({
          where: { plotId: id, status: { in: ["PROPOSED", "ACTIVE", "ALLOCATED"] } },
        }));
      if (
        committed &&
        (data.availability !== previous!.availability || data.publication !== previous!.publication)
      )
        throw new ConflictException(
          "Resolve the existing partnership before changing availability or publication.",
        );
      if (data.publication === "Published") {
        const [photos, documents] = id
          ? await Promise.all([
              tx.plotAsset.count({ where: { plotId: id, kind: "PHOTO" } }),
              tx.plotAsset.count({ where: { plotId: id, kind: "LISTING_DOCUMENT" } }),
            ])
          : [0, 0];
        const publicationIssues = publicationChecklist(data, { saved: !!id, photos, documents });
        if (publicationIssues.length)
          throw new BadRequestException({
            message: "Complete these items before publishing, then save again.",
            publicationIssues,
          });
      }
      const { version: _, ...values } = data;
      const plot = previous
        ? await tx.propertyPlot.update({
            where: { id },
            data: { ...values, version: { increment: 1 } },
            include: plotInclude,
          })
        : await tx.propertyPlot.create({ data: values, include: plotInclude });
      await this.event(
        tx,
        actorId,
        "PLOTS",
        previous ? "Plot updated" : "Plot created",
        plot.id,
        plot.code,
        `${plot.title || "Untitled plot"} · ${plot.publication}`,
      );
      return plot;
    });
  }
  async addAsset(actorId: string, plotId: string, input: unknown) {
    const data = v.parse(v.assetInput, input);
    const bytes = validateAssetBytes(data);
    if (data.kind === "PHOTO") {
      // Authorize before sending bytes to Cloudinary; repeat checks at commit.
      await this.write(actorId, "plots", async (tx) => {
        if (!(await tx.propertyPlot.findUnique({ where: { id: plotId }, select: { id: true } })))
          throw new NotFoundException("Plot not found.");
        if ((await tx.plotAsset.count({ where: { plotId } })) >= 30)
          throw new BadRequestException("Keep up to 30 files per plot.");
      });
    }
    // Network uploads run outside the database transaction and its domain lock.
    const photo =
      data.kind === "PHOTO" ? await this.cloudinary.uploadPhoto(bytes, data.mime) : null;
    return this.write(actorId, "plots", async (tx) => {
      const plot = await tx.propertyPlot.findUnique({ where: { id: plotId } });
      if (!plot) throw new NotFoundException("Plot not found.");
      if ((await tx.plotAsset.count({ where: { plotId } })) >= 30)
        throw new BadRequestException("Keep up to 30 files per plot.");
      const asset = await tx.plotAsset.create({
        data: {
          plotId,
          name: data.name,
          mime: data.mime,
          kind: data.kind,
          data: photo ? null : bytes,
          ...(photo
            ? {
                cloudinaryPublicId: photo.publicId,
                cloudinaryUrl: photo.url,
                cloudinaryFormat: photo.format,
                cloudinaryVersion: photo.version,
              }
            : {}),
        },
        select: assetSelect,
      });
      if (!photo)
        await tx.documentVersion.create({
          data: {
            assetId: asset.id,
            number: 1,
            name: data.name,
            mime: data.mime,
            data: bytes,
            size: bytes.length,
            uploadedBy: (await activityActor(tx, actorId)).name,
          },
        });
      if (photo) await tx.cloudinaryCleanup.deleteMany({ where: { publicId: photo.publicId } });
      await this.event(
        tx,
        actorId,
        "PLOTS",
        "Plot file added",
        plotId,
        plot.code,
        `${data.kind}: ${data.name}`,
      );
      return asset;
    });
  }
  async asset(id: string, access: "public" | "admin" | string) {
    const asset = await this.db.plotAsset.findUnique({
      where: { id },
      include: { plot: { select: { publication: true } } },
    });
    if (!asset) throw new NotFoundException();
    if (
      access === "public" &&
      (asset.plot.publication !== "Published" || asset.kind === "PRIVATE_DOCUMENT")
    )
      throw new NotFoundException();
    if (
      access !== "public" &&
      access !== "admin" &&
      asset.recipientId !== access &&
      !(await this.db.coAllocation.findFirst({ where: { documentId: id, userId: access } }))
    )
      throw new NotFoundException();
    return {
      ...asset,
      deliveryUrl: asset.cloudinaryPublicId
        ? this.cloudinary.deliveryUrl({ ...asset, cloudinaryPublicId: asset.cloudinaryPublicId })
        : null,
    };
  }
  async removeAsset(actorId: string, id: string, section: "plots" | "documents" = "plots") {
    return this.write(actorId, section, async (tx) => {
      const asset = await tx.plotAsset.findUnique({ where: { id }, include: { plot: true } });
      if (!asset) throw new NotFoundException("File not found.");
      if (await tx.coAllocation.findFirst({ where: { documentId: id } }))
        throw new ConflictException("An allocated document must remain in the ownership record.");
      if (
        asset.plot.publication === "Published" &&
        asset.kind !== "PRIVATE_DOCUMENT" &&
        (await tx.plotAsset.count({ where: { plotId: asset.plotId, kind: asset.kind } })) <= 1
      )
        throw new ConflictException(
          "A published plot needs at least one photo and listing document. Add the replacement first.",
        );
      await tx.plotAsset.delete({ where: { id } });
      if (asset.cloudinaryPublicId)
        await tx.cloudinaryCleanup.upsert({
          where: { publicId: asset.cloudinaryPublicId },
          create: { publicId: asset.cloudinaryPublicId, notBefore: new Date() },
          update: { notBefore: new Date() },
        });
      await this.event(
        tx,
        actorId,
        section === "documents" ? "DOCUMENTS" : "PLOTS",
        "Plot file removed",
        asset.plotId,
        asset.plot.code,
        `${asset.kind}: ${asset.name}`,
      );
      return { removed: true };
    });
  }
  async policy() {
    return this.db.coPolicy.findFirst({ orderBy: { version: "desc" } });
  }
  async publishPolicy(actorId: string, input: unknown) {
    const data = v.parse(v.policyInput, input);
    return this.write(actorId, "co-ownership", async (tx) => {
      const actor = await activityActor(tx, actorId);
      if (actor.staffRole !== "SUPER_ADMIN")
        throw new ForbiddenException("Only the Super Admin can publish co-ownership terms.");
      const latest = await tx.coPolicy.findFirst({ orderBy: { version: "desc" } });
      const policy = await tx.coPolicy.create({
        data: { ...data, version: (latest?.version ?? 0) + 1 },
      });
      await this.event(
        tx,
        actorId,
        "CO_OWNERSHIP",
        "Co-ownership terms published",
        policy.id,
        `Terms v${policy.version}`,
        data.title,
      );
      return policy;
    });
  }
  async offers(query: Page) {
    const policy = await this.policy();
    const rows = await this.db.propertyPlot.findMany({
      where: {
        coEnabled: true,
        size: { gte: 500 },
        verification: "verified",
        publication: "Published",
        availability: "Available",
        ...(query.q ? { code: { equals: query.q, mode: "insensitive" as const } } : {}),
      },
      include: plotInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return {
      policy,
      items: policy ? rows.slice(0, 30).map((p) => this.visiblePlot(p, false)) : [],
      nextCursor: policy && rows.length > 30 ? rows[29].id : null,
    };
  }
  private offer(p: {
    price: Prisma.Decimal;
    legalFee: Prisma.Decimal;
    surveyFee: Prisma.Decimal;
    documentationFee: Prisma.Decimal;
    coMonths: number;
    coDepositPercent: number;
  }) {
    const total = p.price.plus(p.legalFee).plus(p.surveyFee).plus(p.documentationFee).div(2);
    return {
      sharePercent: 50,
      land: p.price.div(2).toNumber(),
      legalFee: p.legalFee.div(2).toNumber(),
      surveyFee: p.surveyFee.div(2).toNumber(),
      documentationFee: p.documentationFee.div(2).toNumber(),
      total: total.toNumber(),
      deposit: p.price
        .div(2)
        .mul(p.coDepositPercent)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        .toNumber(),
      months: p.coMonths,
    };
  }
  async createRequest(actorId: string, input: unknown) {
    const data = v.parse(v.requestInput, input);
    return this.write(actorId, null, async (tx) => {
      const existing = await tx.coRequest.findFirst({
        where: { plotId: data.plotId, userId: actorId, status: { not: "CANCELLED" } },
      });
      if (existing) return existing;
      const p = await tx.propertyPlot.findUnique({ where: { id: data.plotId } });
      const policy = await tx.coPolicy.findFirst({ orderBy: { version: "desc" } });
      if (
        !p ||
        !p.coEnabled ||
        p.size < 500 ||
        p.publication !== "Published" ||
        p.availability !== "Available" ||
        p.verification !== "verified"
      )
        throw new ConflictException("This plot is no longer available for co-ownership.");
      if (p.version !== data.version || policy?.id !== data.policyId)
        throw new ConflictException(
          "The offer or terms changed. Reload and review before submitting.",
        );
      const request = await tx.coRequest.create({
        data: {
          userId: actorId,
          plotId: p.id,
          policyId: policy.id,
          offer: this.offer(p),
          preference: data.preference,
        },
      });
      await this.event(
        tx,
        actorId,
        "CO_OWNERSHIP",
        "Co-ownership requested",
        request.id,
        p.code,
        `Terms v${policy.version} accepted. No payment collected.`,
      );
      await this.notify(
        tx,
        [actorId],
        "Co-ownership request received",
        `Your request for ${p.code} is waiting for a suitable partner. No payment has been collected.`,
      );
      return request;
    });
  }
  async requests(query: Page, userId?: string) {
    if (
      query.status &&
      !["WAITING", "PROPOSED", "ACTIVE", "ALLOCATED", "CANCELLED"].includes(query.status)
    )
      throw new BadRequestException("Invalid request status.");
    const where: Prisma.CoRequestWhereInput = {
      ...(userId ? { userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { plot: { code: { contains: query.q, mode: "insensitive" } } } : {}),
    };
    const rows = await this.db.coRequest.findMany({
      where,
      include: {
        ...requestInclude,
        match: {
          include: {
            requests: {
              select: {
                id: true,
                userId: true,
                acceptedAt: true,
                user: { select: { name: true } },
              },
            },
            allocations: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 30).map((r) =>
        userId
          ? {
              ...r,
              plot: this.visiblePlot(r.plot, false),
              match: r.match
                ? {
                    ...r.match,
                    notes: undefined,
                    allocations: r.match.allocations.filter((a) => a.userId === userId),
                    requests: r.match.requests.map((partner) => ({
                      id: partner.id,
                      userId: partner.userId,
                      acceptedAt: partner.acceptedAt,
                      user: { name: partner.user.name },
                    })),
                  }
                : null,
            }
          : r,
      ),
      nextCursor: rows.length > 30 ? rows[29].id : null,
      total: await this.db.coRequest.count({ where }),
    };
  }
  async buyerSummary(userId: string) {
    const [groups, funds, owned] = await Promise.all([
      this.db.coRequest.groupBy({ by: ["status"], where: { userId }, _count: true }),
      this.db.coContribution.aggregate({ where: { request: { userId } }, _sum: { amount: true } }),
      this.db.coRequest.findMany({
        where: { userId, status: { in: ["ACTIVE", "ALLOCATED"] } },
        select: { plot: { select: { state: true } } },
      }),
    ]);
    const count = (status: string) => groups.find((g) => g.status === status)?._count ?? 0;
    return {
      active: count("ACTIVE"),
      allocated: count("ALLOCATED"),
      waiting: count("WAITING"),
      proposed: count("PROPOSED"),
      confirmed: funds._sum.amount ?? 0,
      states: [...new Set(owned.map((r) => r.plot.state))],
    };
  }
  async propose(actorId: string, input: unknown) {
    const data = v.parse(v.matchInput, input);
    return this.write(actorId, "co-ownership", async (tx) => {
      const requests = await tx.coRequest.findMany({
        where: { id: { in: [data.firstRequestId, data.secondRequestId] } },
        include: { plot: true },
      });
      if (
        requests.length !== 2 ||
        requests.some((r) => r.status !== "WAITING") ||
        requests[0].userId === requests[1].userId ||
        requests[0].plotId !== requests[1].plotId
      )
        throw new ConflictException(
          "Choose two waiting requests from different buyers for the same plot.",
        );
      if (
        requests[0].policyId !== requests[1].policyId ||
        JSON.stringify(requests[0].offer) !== JSON.stringify(requests[1].offer)
      )
        throw new ConflictException(
          "Both buyers must have accepted the same terms and pricing. Ask them to review a new request.",
        );
      const p = requests[0].plot;
      if (
        await tx.plotReservation.count({
          where: {
            plotId: p.id,
            OR: [
              { status: "ACTIVE" },
              { status: "PENDING", checkoutExpiresAt: { gt: new Date() } },
            ],
          },
        })
      )
        throw new ConflictException(
          "This plot already has a reservation or an open reservation checkout.",
        );
      if (
        (await tx.user.count({
          where: {
            id: { in: requests.map((r) => r.userId) },
            staffRole: null,
            emailVerifiedAt: { not: null },
          },
        })) !== 2
      )
        throw new ConflictException("Both participants must still be verified buyer accounts.");
      if (
        p.availability !== "Available" ||
        p.publication !== "Published" ||
        !p.coEnabled ||
        p.size < 500 ||
        p.verification !== "verified"
      )
        throw new ConflictException("The plot is no longer available.");
      const match = await tx.coMatch.create({
        data: { plotId: p.id, agreement: data.agreement, notes: data.notes },
      });
      await tx.coRequest.updateMany({
        where: { id: { in: requests.map((r) => r.id) } },
        data: { status: "PROPOSED", matchId: match.id, acceptedAt: null },
      });
      await tx.propertyPlot.update({
        where: { id: p.id },
        data: { availability: "Reserved", version: { increment: 1 } },
      });
      await this.event(
        tx,
        actorId,
        "CO_OWNERSHIP",
        "Partner match proposed",
        match.id,
        p.code,
        "Both buyers must review and accept the agreement.",
      );
      await this.notify(
        tx,
        requests.map((r) => r.userId),
        "Review your proposed partner match",
        `A partner match for ${p.code} is ready. Open Co-ownership to review the agreement and accept or decline.`,
      );
      return match;
    });
  }
  async match(id: string) {
    const match = await this.db.coMatch.findUnique({
      where: { id },
      include: {
        plot: { include: plotInclude },
        requests: { include: requestInclude },
        allocations: true,
      },
    });
    if (!match) throw new NotFoundException();
    return match;
  }
  async candidates(id: string, query: Page) {
    const request = await this.db.coRequest.findUnique({ where: { id } });
    if (!request || request.status !== "WAITING")
      throw new NotFoundException("Waiting request not found.");
    const rows = await this.db.coRequest.findMany({
      where: {
        plotId: request.plotId,
        status: "WAITING",
        id: { not: id },
        userId: { not: request.userId },
        policyId: request.policyId,
        offer: { equals: request.offer as Prisma.InputJsonValue },
      },
      include: requestInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return { items: rows.slice(0, 30), nextCursor: rows.length > 30 ? rows[29].id : null };
  }
  async accept(actorId: string, id: string, input: unknown) {
    const { matchId } = v.parse(v.matchAcceptanceInput, input);
    return this.write(actorId, null, async (tx) => {
      const r = await tx.coRequest.findFirst({
        where: { id, userId: actorId },
        include: { match: true, plot: true },
      });
      if (!r) throw new NotFoundException();
      if (r.matchId !== matchId)
        throw new ConflictException(
          "The proposed match changed. Reload and review the current agreement.",
        );
      if (r.acceptedAt && ["PROPOSED", "ACTIVE", "ALLOCATED"].includes(r.status))
        return { status: r.status };
      if (r.status !== "PROPOSED" || r.match?.status !== "PROPOSED")
        throw new ConflictException("There is no proposed agreement to accept.");
      await tx.coRequest.update({ where: { id }, data: { acceptedAt: new Date() } });
      const partners = await tx.coRequest.findMany({ where: { matchId: r.matchId } });
      if (partners.length === 2 && partners.every((p) => p.acceptedAt)) {
        await tx.coMatch.update({ where: { id: r.matchId! }, data: { status: "ACTIVE" } });
        await tx.coRequest.updateMany({
          where: { matchId: r.matchId },
          data: { status: "ACTIVE" },
        });
        await this.notify(
          tx,
          partners.map((p) => p.userId),
          "Your partnership is confirmed",
          `Both buyers accepted the agreement for ${r.plot.code}. Your contribution records will appear in Co-ownership.`,
        );
      }
      await this.event(
        tx,
        actorId,
        "CO_OWNERSHIP",
        "Partner agreement accepted",
        id,
        r.plot.code,
        "Buyer accepted the proposed agreement.",
      );
      return { status: partners.every((p) => p.acceptedAt) ? "ACTIVE" : "PROPOSED" };
    });
  }
  async cancel(actorId: string, id: string, admin = false) {
    return this.write(actorId, admin ? "co-ownership" : null, async (tx) => {
      const r = await tx.coRequest.findFirst({
        where: { id, ...(!admin ? { userId: actorId } : {}) },
        include: { plot: true },
      });
      if (!r) throw new NotFoundException();
      if (r.status === "CANCELLED") return { status: r.status };
      if (!["WAITING", "PROPOSED"].includes(r.status))
        throw new ConflictException(
          "Active partnerships require an agreed exit process. Contact MIRAI.",
        );
      if (r.matchId) {
        const partners = await tx.coRequest.findMany({ where: { matchId: r.matchId } });
        await tx.coMatch.update({ where: { id: r.matchId }, data: { status: "CANCELLED" } });
        await tx.coRequest.updateMany({
          where: { matchId: r.matchId, id: { not: id } },
          data: { status: "WAITING", matchId: null, acceptedAt: null },
        });
        await tx.propertyPlot.update({
          where: { id: r.plotId },
          data: { availability: "Available", version: { increment: 1 } },
        });
        await this.notify(
          tx,
          partners.map((p) => p.userId),
          "Partner match cancelled",
          `The proposed match for ${r.plot.code} was cancelled. The remaining buyer's request has returned to matching.`,
        );
      }
      await tx.coRequest.update({ where: { id }, data: { status: "CANCELLED", acceptedAt: null } });
      await this.event(
        tx,
        actorId,
        "CO_OWNERSHIP",
        "Co-ownership request cancelled",
        id,
        r.plot.code,
        "Request cancelled before partnership activation. No refund transaction was created.",
      );
      return { status: "CANCELLED" };
    });
  }
  async contribute(actorId: string, input: unknown) {
    const data = v.parse(v.contributionInput, input);
    return this.write(actorId, "co-ownership", async (tx) => {
      if (new Date(data.receivedAt).getTime() > Date.now())
        throw new BadRequestException("The received date cannot be in the future.");
      const existing = await tx.coContribution.findUnique({ where: { reference: data.reference } });
      if (existing) {
        if (
          existing.requestId === data.requestId &&
          existing.amount.equals(data.amount) &&
          existing.receivedAt.toISOString() === new Date(data.receivedAt).toISOString()
        )
          return existing;
        throw new ConflictException("This payment reference has already been used.");
      }
      const r = await tx.coRequest.findUnique({
        where: { id: data.requestId },
        include: { match: true, contributions: true, plot: true },
      });
      if (!r || r.status !== "ACTIVE" || r.match?.status !== "ACTIVE")
        throw new ConflictException(
          "Record contributions only after both buyers accept the agreement.",
        );
      const total = (r.offer as { total: number }).total;
      const paid = r.contributions.reduce((sum, c) => sum.plus(c.amount), new Prisma.Decimal(0));
      if (paid.plus(data.amount).gt(total))
        throw new BadRequestException("This amount exceeds the buyer's outstanding balance.");
      const payment = await tx.coContribution.create({
        data: { ...data, receivedAt: new Date(data.receivedAt) },
      });
      await this.event(
        tx,
        actorId,
        "CO_OWNERSHIP",
        "Contribution confirmed",
        payment.id,
        r.plot.code,
        `${data.amount} NGN confirmed against reference ${data.reference}.`,
      );
      await this.notify(
        tx,
        [r.userId],
        "Contribution recorded",
        `MIRAI recorded NGN ${data.amount.toLocaleString("en-NG")} for ${r.plot.code}. Reference: ${data.reference}.`,
      );
      return payment;
    });
  }
  async allocate(actorId: string, matchId: string, input: unknown) {
    const data = v.parse(v.allocationInput, input);
    return this.write(actorId, "co-ownership", async (tx) => {
      const match = await tx.coMatch.findUnique({
        where: { id: matchId },
        include: { requests: { include: { contributions: true } }, plot: true },
      });
      if (!match) throw new NotFoundException();
      if (match.status !== "ACTIVE" || match.requests.length !== 2)
        throw new ConflictException("Only an active partnership can be allocated.");
      if (
        new Set(data.portions.map((p) => p.userId)).size !== 2 ||
        new Set(data.portions.map((p) => p.documentId)).size !== 2
      )
        throw new BadRequestException("Provide one separate allocation document for each buyer.");
      for (const r of match.requests) {
        const portion = data.portions.find((p) => p.userId === r.userId);
        if (!portion) throw new BadRequestException("Each partner needs an allocation.");
        const paid = r.contributions.reduce((sum, c) => sum.plus(c.amount), new Prisma.Decimal(0));
        if (paid.lt((r.offer as { total: number }).total))
          throw new ConflictException("Both partners must be fully paid before allocation.");
        if (
          !(await tx.plotAsset.findFirst({
            where: {
              id: portion.documentId,
              plotId: match.plotId,
              kind: "PRIVATE_DOCUMENT",
              mime: "application/pdf",
            },
          }))
        )
          throw new BadRequestException("Upload a private PDF allocation document for this plot.");
      }
      await tx.coAllocation.createMany({ data: data.portions.map((p) => ({ ...p, matchId })) });
      await tx.coMatch.update({ where: { id: matchId }, data: { status: "ALLOCATED" } });
      await tx.coRequest.updateMany({ where: { matchId }, data: { status: "ALLOCATED" } });
      await tx.propertyPlot.update({
        where: { id: match.plotId },
        data: { availability: "Sold", version: { increment: 1 } },
      });
      await this.event(
        tx,
        actorId,
        "CO_OWNERSHIP",
        "Co-ownership allocated",
        matchId,
        match.plot.code,
        "Both contributions completed; separate allocation documents recorded.",
      );
      await this.notify(
        tx,
        match.requests.map((r) => r.userId),
        "Your allocation is ready",
        `Your allocation for ${match.plot.code} is recorded. Open Co-ownership to download your document.`,
      );
      return { status: "ALLOCATED" };
    });
  }
}
