import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { activityActor, recordActivity } from "../activity/record-activity";
import { resolveStaffPermissions } from "../auth/staff-permissions";
import { parse } from "../property/property.validation";
import { PaystackService, PaystackTransaction } from "./paystack.service";
import { config } from "../config";

const TERMS = "reservation-test-v1";
const checkoutInput = z
  .object({
    plotId: z.string().uuid(),
    version: z.number().int(),
    termsVersion: z.literal(TERMS),
    accepted: z.literal(true),
  })
  .strict();
const referenceInput = z.string().regex(/^MIRAI-[a-f0-9]{32}$/);
type Tx = Prisma.TransactionClient;
const include = {
  payment: true,
  user: { select: { id: true, name: true, email: true } },
  plot: { select: { id: true, code: true, title: true, state: true, location: true, size: true } },
} as const;

@Injectable()
export class ReservationService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private expiring = false;
  constructor(
    private readonly db: PrismaService,
    private readonly paystack: PaystackService,
  ) {}
  onModuleInit() {
    if (config.NODE_ENV !== "test") {
      this.timer = setInterval(() => {
        void this.expire().catch(() => undefined);
      }, 60000);
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  private write<T>(work: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(461992014)`;
        return work(tx);
      },
      { timeout: 30000 },
    );
  }
  private async buyer(tx: Tx, id: string) {
    const user = await tx.user.findUniqueOrThrow({ where: { id } });
    if (user.staffRole || !user.emailVerifiedAt)
      throw new ForbiddenException("Use a verified customer account to reserve a plot.");
    return user;
  }
  private async audit(
    tx: Tx,
    userId: string,
    id: string,
    label: string,
    action: string,
    detail: string,
  ) {
    await recordActivity(tx, await activityActor(tx, userId), {
      category: "PAYMENTS",
      action,
      targetId: id,
      targetLabel: label,
      detail,
    });
  }
  private async expireIn(tx: Tx, plotId?: string) {
    const now = new Date();
    const expired = await tx.plotReservation.findMany({
      where: {
        ...(plotId ? { plotId } : {}),
        OR: [
          { status: "PENDING", checkoutExpiresAt: { lte: now } },
          { status: "ACTIVE", accessExpiresAt: { lte: now } },
        ],
      },
      take: 100,
    });
    for (const row of expired) {
      await tx.plotReservation.update({ where: { id: row.id }, data: { status: "EXPIRED" } });
      if (row.status === "ACTIVE") {
        const match = await tx.coMatch.count({
          where: { plotId: row.plotId, status: { in: ["PROPOSED", "ACTIVE", "ALLOCATED"] } },
        });
        if (!match)
          await tx.propertyPlot.updateMany({
            where: { id: row.plotId, availability: "Reserved" },
            data: { availability: "Available", version: { increment: 1 } },
          });
      }
    }
  }
  async expire() {
    if (this.expiring) return;
    this.expiring = true;
    try {
      await this.write((tx) => this.expireIn(tx));
    } finally {
      this.expiring = false;
    }
  }
  async initialize(userId: string, input: unknown) {
    this.paystack.assertConfigured();
    const data = parse(checkoutInput, input);
    const record = await this.write(async (tx) => {
      const user = await this.buyer(tx, userId);
      await this.expireIn(tx, data.plotId);
      const existing = await tx.plotReservation.findFirst({
        where: { plotId: data.plotId, status: { in: ["PENDING", "ACTIVE"] } },
        include,
      });
      if (existing) {
        if (existing.userId === userId) return existing;
        throw new ConflictException(
          "Another buyer is reserving this plot. Please choose another plot or try again later.",
        );
      }
      const plot = await tx.propertyPlot.findUnique({ where: { id: data.plotId } });
      if (!plot || plot.publication !== "Published" || plot.availability !== "Available")
        throw new ConflictException("This plot is no longer available for reservation.");
      if (plot.version !== data.version)
        throw new ConflictException(
          "The listing changed. Refresh the plot and review its fees before paying.",
        );
      const amount = plot.reservationFee.mul(100);
      if (!amount.isInteger() || amount.lte(0) || amount.gt(Number.MAX_SAFE_INTEGER))
        throw new BadRequestException("This plot needs a valid reservation fee before checkout.");
      const row = await tx.plotReservation.create({
        data: {
          userId,
          plotId: plot.id,
          amountKobo: BigInt(amount.toString()),
          accessMonths: plot.accessMonths,
          termsVersion: TERMS,
          acceptedAt: new Date(),
          checkoutExpiresAt: new Date(Date.now() + 20 * 60000),
          snapshot: {
            code: plot.code,
            title: plot.title,
            price: plot.price.toString(),
            legalFee: plot.legalFee.toString(),
            surveyFee: plot.surveyFee.toString(),
            documentationFee: plot.documentationFee.toString(),
            reservationFee: plot.reservationFee.toString(),
            accessMonths: plot.accessMonths,
            termsVersion: TERMS,
            mode: "test",
          },
          payment: {
            create: {
              reference: `MIRAI-${randomUUID().replaceAll("-", "")}`,
              amountKobo: BigInt(amount.toString()),
            },
          },
        },
        include,
      });
      await this.audit(
        tx,
        user.id,
        row.id,
        plot.code,
        "Reservation checkout started",
        "Reservation checkout; no land ownership transferred.",
      );
      return row;
    });
    if (record.status === "ACTIVE")
      return { ...this.present(record, false), authorizationUrl: null };
    let authorizationUrl = record.payment!.authorizationUrl;
    if (!authorizationUrl) {
      authorizationUrl = await this.paystack.initialize(
        record.user.email,
        Number(record.amountKobo),
        record.payment!.reference,
      );
      await this.db.reservationPayment.update({
        where: { id: record.payment!.id },
        data: { authorizationUrl },
      });
    }
    return { ...this.present(record, false), authorizationUrl };
  }
  async verify(userId: string, input: unknown, admin = false) {
    const reference = parse(referenceInput, input);
    const payment = await this.db.reservationPayment.findUnique({
      where: { reference },
      include: { reservation: { include } },
    });
    if (!payment || (!admin && payment.reservation.userId !== userId))
      throw new NotFoundException("Payment not found.");
    if (admin) {
      const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
      if (!resolveStaffPermissions(user).includes("payments")) throw new ForbiddenException();
    }
    if (payment.status === "SUCCESS") return this.present(payment.reservation, admin);
    const result = await this.paystack.verify(reference);
    if (result.reference !== reference)
      throw new BadRequestException("Paystack returned a different payment reference.");
    return this.settle(result, admin);
  }
  private async settle(data: PaystackTransaction, admin: boolean) {
    return this.write(async (tx) => {
      const payment = await tx.reservationPayment.findUnique({
        where: { reference: data.reference },
        include: { reservation: { include } },
      });
      if (!payment) throw new NotFoundException("Payment not found.");
      const r = payment.reservation;
      if (payment.status === "SUCCESS") return this.present(r, admin);
      // Provider amount, currency, account mode and customer must match our saved intent.
      if (
        !Number.isSafeInteger(data.amount) ||
        BigInt(data.amount) !== payment.amountKobo ||
        data.currency !== "NGN" ||
        data.domain !== payment.mode ||
        data.customer?.email?.toLowerCase() !== r.user.email.toLowerCase()
      )
        throw new BadRequestException(
          "Payment details do not match this reservation. Contact MIRAI with your reference.",
        );
      if (data.status !== "success") {
        if (["failed", "abandoned", "reversed"].includes(data.status)) {
          await tx.reservationPayment.update({
            where: { id: payment.id },
            data: { status: "FAILED" },
          });
          if (r.status === "PENDING")
            await tx.plotReservation.update({ where: { id: r.id }, data: { status: "FAILED" } });
        }
        return this.present(
          await tx.plotReservation.findUniqueOrThrow({ where: { id: r.id }, include }),
          admin,
        );
      }
      if (data.id == null || !data.paid_at || !Number.isFinite(Date.parse(data.paid_at)))
        throw new BadRequestException("Paystack has not returned a confirmed payment date.");
      const plot = await tx.propertyPlot.findUniqueOrThrow({ where: { id: r.plotId } });
      const other = await tx.plotReservation.count({
        where: {
          plotId: r.plotId,
          id: { not: r.id },
          OR: [{ status: "ACTIVE" }, { status: "PENDING", checkoutExpiresAt: { gt: new Date() } }],
        },
      });
      const match = await tx.coMatch.count({
        where: { plotId: r.plotId, status: { in: ["PROPOSED", "ACTIVE", "ALLOCATED"] } },
      });
      const eligible =
        r.status === "PENDING" &&
        r.checkoutExpiresAt > new Date() &&
        plot.publication === "Published" &&
        plot.availability === "Available" &&
        !other &&
        !match;
      const expires = new Date();
      expires.setUTCMonth(expires.getUTCMonth() + r.accessMonths);
      await tx.reservationPayment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", providerId: String(data.id), paidAt: new Date(data.paid_at) },
      });
      await tx.plotReservation.update({
        where: { id: r.id },
        data: {
          status: eligible ? "ACTIVE" : "REVIEW_REQUIRED",
          accessExpiresAt: eligible ? expires : null,
          reviewReason: eligible
            ? null
            : "Payment arrived after the checkout expired or the plot became unavailable. Confirmed payment requires staff review; no reservation was granted.",
        },
      });
      if (eligible)
        await tx.propertyPlot.update({
          where: { id: r.plotId },
          data: { availability: "Reserved", version: { increment: 1 } },
        });
      await tx.buyerNotification.create({
        data: {
          userId: r.userId,
          title: eligible ? "Reservation confirmed" : "Payment received; review required",
          body: `${r.plot.code}: ₦${(Number(payment.amountKobo) / 100).toLocaleString("en-NG")} payment confirmed. ${eligible ? "Your reservation is in Land Library." : "Contact MIRAI with your payment reference. Your plot has not been reserved."}`,
          href: "/dashboard/payments",
        },
      });
      await this.audit(
        tx,
        r.userId,
        r.id,
        r.plot.code,
        eligible ? "Reservation confirmed" : "Payment needs review",
        `${payment.reference} · NGN ${Number(payment.amountKobo) / 100} · Paystack`,
      );
      return this.present(
        await tx.plotReservation.findUniqueOrThrow({ where: { id: r.id }, include }),
        admin,
      );
    });
  }
  async webhook(raw: Buffer | undefined, signature: unknown, body: unknown) {
    this.paystack.authenticateWebhook(raw, signature);
    const event = parse(
      z
        .object({ event: z.string(), data: z.object({ reference: referenceInput }).passthrough() })
        .passthrough(),
      body,
    );
    if (event.event !== "charge.success") return { received: true };
    const payment = await this.db.reservationPayment.findUnique({
      where: { reference: event.data.reference },
    });
    if (payment && payment.status !== "SUCCESS") {
      const result = await this.paystack.verify(payment.reference);
      if (result.reference !== payment.reference)
        throw new BadRequestException("Unexpected payment reference.");
      await this.settle(result, false);
    }
    return { received: true };
  }
  private present(
    row: Prisma.PlotReservationGetPayload<{ include: typeof include }>,
    admin: boolean,
  ) {
    return {
      id: row.id,
      status: row.status,
      amount: Number(row.amountKobo) / 100,
      accessMonths: row.accessMonths,
      termsVersion: row.termsVersion,
      acceptedAt: row.acceptedAt,
      snapshot: row.snapshot,
      checkoutExpiresAt: row.checkoutExpiresAt,
      accessExpiresAt: row.accessExpiresAt,
      reviewReason: row.reviewReason,
      createdAt: row.createdAt,
      plot: row.plot,
      ...(admin ? { buyer: row.user } : {}),
      payment: row.payment
        ? {
            reference: row.payment.reference,
            amount: Number(row.payment.amountKobo) / 100,
            status: row.payment.status,
            mode: row.payment.mode,
            paidAt: row.payment.paidAt,
            authorizationUrl: row.status === "PENDING" ? row.payment.authorizationUrl : null,
          }
        : null,
    };
  }
  async list(
    userId: string,
    query: { cursor?: string; q?: string; status?: string },
    section?: "payments" | "reservations",
  ) {
    await this.expire();
    if (section) {
      const actor = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
      if (!resolveStaffPermissions(actor).includes(section)) throw new ForbiddenException();
    }
    if (
      query.status &&
      !["PENDING", "ACTIVE", "EXPIRED", "FAILED", "REVIEW_REQUIRED"].includes(query.status)
    )
      throw new BadRequestException("Invalid reservation status.");
    const where: Prisma.PlotReservationWhereInput = {
      ...(!section ? { userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { plot: { code: { contains: query.q, mode: "insensitive" } } },
              ...(section
                ? [{ user: { email: { contains: query.q, mode: "insensitive" as const } } }]
                : []),
            ],
          }
        : {}),
    };
    const [rows, total, active, paid] = await Promise.all([
      this.db.plotReservation.findMany({
        where,
        include,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 31,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.db.plotReservation.count({ where }),
      this.db.plotReservation.count({
        where: { ...(!section ? { userId } : {}), status: "ACTIVE" },
      }),
      this.db.reservationPayment.aggregate({
        where: { status: "SUCCESS", ...(!section ? { reservation: { userId } } : {}) },
        _sum: { amountKobo: true },
      }),
    ]);
    return {
      items: rows.slice(0, 30).map((r) => this.present(r, !!section)),
      nextCursor: rows.length > 30 ? rows[29].id : null,
      total,
      stats: { active, confirmed: Number(paid._sum.amountKobo || 0n) / 100, mode: "test" },
      termsVersion: TERMS,
    };
  }
}
