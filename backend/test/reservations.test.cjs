const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");

test(
  "Paystack reservation lifecycle in isolated PostgreSQL",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async (t) => {
    const { Client } = require("pg");
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = "mirai_payments_" + randomUUID().replaceAll("-", "");
    let app;
    await admin.connect();
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      const sql = fs
        .readdirSync("prisma/migrations", { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
        .map((name) => fs.readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"))
        .join("\n")
        .replace(/^BEGIN;\r?$/gm, "")
        .replace(/^COMMIT;\r?$/gm, "")
        .replaceAll('"public"', `"${schema}"`);
      await admin.query("BEGIN");
      await admin.query(`SET LOCAL search_path TO "${schema}"`);
      await admin.query(sql);
      await admin.query("COMMIT");
      const url = new URL(process.env.DATABASE_URL);
      url.searchParams.set("schema", schema);
      process.env.DATABASE_URL = url.toString();
      process.env.NODE_ENV = "test";
      process.env.PAYSTACK_SECRET_KEY = "sk_test_integration";
      process.env.PAYSTACK_PUBLIC_KEY = "pk_test_integration";
      const gateway = new Map();
      const { Test } = require("@nestjs/testing");
      const { ThrottlerStorage } = require("@nestjs/throttler");
      const { AppModule } = require("../dist/app.module");
      const { PaystackService } = require("../dist/payments/paystack.service");
      const { PaystackService: RealGateway } = require("../dist/payments/paystack.service");
      const { CloudinaryService } = require("../dist/property/cloudinary.service");
      const { PrismaService } = require("../dist/database/prisma.service");
      const { JwtService } = require("@nestjs/jwt");
      const { config } = require("../dist/config");
      const { setupApp } = require("../dist/setup");
      app = (
        await Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(PaystackService)
          .useValue({
            assertConfigured() {},
            initialize: async (email, amount, reference) => {
              gateway.set(reference, {
                reference,
                amount,
                customer: { email },
                currency: "NGN",
                domain: "test",
                status: "pending",
                id: reference,
                paid_at: null,
              });
              return "https://checkout.paystack.com/test-" + reference;
            },
            verify: async (reference) => {
              if (!gateway.has(reference)) throw new Error("Unknown reference");
              return structuredClone(gateway.get(reference));
            },
            authenticateWebhook: (raw, signature) =>
              new RealGateway().authenticateWebhook(raw, signature),
          })
          .overrideProvider(CloudinaryService)
          .useValue({
            uploadPhoto: async () => ({
              publicId: `mirai/plots/${randomUUID()}`,
              url: "https://res.cloudinary.com/test/image/authenticated/test.png",
              format: "png",
              version: 1,
            }),
            deliveryUrl: () =>
              "https://res.cloudinary.com/test/image/authenticated/s--signed--/test.png",
          })
          .compile()
      ).createNestApplication({ rawBody: true });
      setupApp(app);
      await app.init();
      t.beforeEach(() => app.get(ThrottlerStorage).onApplicationShutdown());
      const db = app.get(PrismaService),
        api = require("supertest")(app.getHttpServer());
      async function account(name, role = null, permissions = []) {
        const user = await db.user.create({
          data: {
            name,
            email: `${name}@example.invalid`,
            passwordHash: "not-a-login-password",
            emailVerifiedAt: new Date(),
            staffRole: role,
            staffActive: !!role,
            staffPermissions: permissions,
          },
        });
        const session = await db.session.create({
          data: {
            userId: user.id,
            familyId: randomUUID(),
            refreshTokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        const token = await app.get(JwtService).signAsync(
          { sub: user.id, sid: session.id },
          {
            secret: config.JWT_SECRET,
            algorithm: "HS256",
            issuer: config.API_URL,
            audience: "mirai-web",
            expiresIn: "1h",
          },
        );
        return { ...user, token };
      }
      const owner = await account("owner", "SUPER_ADMIN"),
        staff = await account("staff", "ADMIN"),
        limited = await account("limited", "ADMIN", ["dashboard"]);
      const a = await account("buyer-a"),
        b = await account("buyer-b"),
        c = await account("buyer-c");
      const get = (path, user = owner) =>
        api.get("/api/v1" + path).auth(user.token, { type: "bearer" });
      const post = (path, body, user = owner) =>
        api
          .post("/api/v1" + path)
          .auth(user.token, { type: "bearer" })
          .send(body);
      const makePlot = (code) =>
        db.propertyPlot.create({
          data: {
            code,
            title: "600 sqm plot in Epe",
            description: "Test plot",
            location: "Epe",
            lga: "Epe",
            state: "Lagos",
            size: 600,
            price: 6000000,
            legalFee: 100000,
            surveyFee: 200000,
            documentationFee: 100000,
            reservationFee: 30000,
            accessMonths: 12,
            publication: "Published",
            availability: "Available",
            details: {},
          },
        });
      const payload = (p) => ({
        plotId: p.id,
        version: p.version,
        termsVersion: "reservation-test-v1",
        accepted: true,
      });
      function paid(reference, extra = {}) {
        Object.assign(gateway.get(reference), {
          status: "success",
          paid_at: new Date().toISOString(),
          ...extra,
        });
      }
      let plot, checkout, ref;
      await t.test(
        "checkout requires a verified non-staff account, terms and server-priced fees",
        async () => {
          plot = await makePlot("PAY-001");
          await api.post("/api/v1/reservations/checkout").send(payload(plot)).expect(401);
          await post("/reservations/checkout", payload(plot), owner).expect(403);
          await post("/reservations/checkout", { ...payload(plot), accepted: false }, a).expect(
            400,
          );
          await post("/reservations/checkout", { ...payload(plot), amount: 1 }, a).expect(400);
          await post("/reservations/checkout", { ...payload(plot), version: 999 }, a).expect(409);
          checkout = (await post("/reservations/checkout", payload(plot), a).expect(201)).body;
          ref = checkout.payment.reference;
          assert.equal(checkout.amount, 30000);
          assert.equal(gateway.get(ref).amount, 3000000);
          assert.equal(checkout.status, "PENDING");
          assert.match(checkout.authorizationUrl, /^https:\/\/checkout.paystack.com\//);
          assert.equal(
            (await db.propertyPlot.findUnique({ where: { id: plot.id } })).availability,
            "Available",
          );
        },
      );
      await t.test(
        "reuses a checkout and prevents a second buyer or conflicting admin edit",
        async () => {
          const retry = (await post("/reservations/checkout", payload(plot), a).expect(201)).body;
          assert.equal(retry.payment.reference, ref);
          await post("/reservations/checkout", payload(plot), b).expect(409);
          await post("/reservations/verify", { reference: ref }, b).expect(404);
          assert.equal(await db.plotReservation.count({ where: { plotId: plot.id } }), 1);
          assert.equal(
            (await post("/reservations/verify", { reference: ref }, a).expect(201)).body.status,
            "PENDING",
          );
        },
      );
      await t.test(
        "rejects mismatched amount, currency, test mode, email and reference",
        async () => {
          const correct = structuredClone(gateway.get(ref));
          for (const extra of [
            { amount: 1 },
            { currency: "USD" },
            { domain: "live" },
            { customer: { email: b.email } },
            { reference: "MIRAI-" + "0".repeat(32) },
          ]) {
            gateway.set(ref, {
              ...correct,
              status: "success",
              paid_at: new Date().toISOString(),
              ...extra,
            });
            await post("/reservations/verify", { reference: ref }, a).expect(400);
          }
          gateway.set(ref, correct);
          assert.equal(
            (await db.reservationPayment.findUnique({ where: { reference: ref } })).status,
            "PENDING",
          );
        },
      );
      await t.test(
        "verified success creates one reservation, payment, notification and audit entry",
        async () => {
          paid(ref);
          const result = (await post("/reservations/verify", { reference: ref }, a).expect(201))
            .body;
          assert.equal(result.status, "ACTIVE");
          assert.equal(result.payment.status, "SUCCESS");
          assert.ok(result.accessExpiresAt);
          assert.equal(result.buyer, undefined);
          assert.equal(
            (await db.propertyPlot.findUnique({ where: { id: plot.id } })).availability,
            "Reserved",
          );
          await post("/reservations/verify", { reference: ref }, a).expect(201);
          assert.equal(
            await db.buyerNotification.count({
              where: { userId: a.id, href: "/dashboard/payments" },
            }),
            1,
          );
          assert.equal(
            await db.activityEvent.count({
              where: { targetId: result.id, action: "Reservation confirmed" },
            }),
            1,
          );
          await post("/reservations/checkout", payload(plot), b).expect(409);
          const list = (await get("/reservations", a).expect(200)).body;
          assert.equal(list.items[0].payment.reference, ref);
          assert.equal(list.stats.active, 1);
          assert.equal(list.stats.confirmed, 30000);
          assert.equal((await get("/reservations", b).expect(200)).body.total, 0);
        },
      );
      await t.test(
        "admin lists enforce permissions and show the matching buyer/payment",
        async () => {
          await get("/admin/payments", a).expect(403);
          await get("/admin/payments", limited).expect(403);
          const list = (await get("/admin/payments", staff).expect(200)).body;
          assert.equal(list.items[0].buyer.email, a.email);
          assert.equal(list.stats.confirmed, 30000);
          assert.equal(
            (await get("/admin/reservations?status=ACTIVE", owner).expect(200)).body.total,
            1,
          );
          await post("/admin/payments/verify", { reference: ref }, limited).expect(403);
        },
      );
      await t.test(
        "failed payments do not reserve a plot and can be retried with a new reference",
        async () => {
          const p = await makePlot("PAY-FAILED");
          const first = (await post("/reservations/checkout", payload(p), a).expect(201)).body;
          gateway.get(first.payment.reference).status = "failed";
          const failed = (
            await post("/reservations/verify", { reference: first.payment.reference }, a).expect(
              201,
            )
          ).body;
          assert.equal(failed.status, "FAILED");
          assert.equal(failed.payment.status, "FAILED");
          assert.equal(
            (await db.propertyPlot.findUnique({ where: { id: p.id } })).availability,
            "Available",
          );
          const retry = (await post("/reservations/checkout", payload(p), a).expect(201)).body;
          assert.notEqual(retry.payment.reference, first.payment.reference);
        },
      );
      await t.test(
        "late successful payments require review without taking another buyer's reservation",
        async () => {
          const p = await makePlot("PAY-LATE");
          const first = (await post("/reservations/checkout", payload(p), a).expect(201)).body;
          await db.plotReservation.update({
            where: { id: first.id },
            data: { checkoutExpiresAt: new Date(Date.now() - 1000) },
          });
          const second = (await post("/reservations/checkout", payload(p), b).expect(201)).body;
          paid(first.payment.reference);
          const late = (
            await post("/reservations/verify", { reference: first.payment.reference }, a).expect(
              201,
            )
          ).body;
          assert.equal(late.status, "REVIEW_REQUIRED");
          assert.equal(late.payment.status, "SUCCESS");
          assert.equal(late.accessExpiresAt, null);
          assert.equal(
            (await db.plotReservation.findUnique({ where: { id: second.id } })).status,
            "PENDING",
          );
          paid(second.payment.reference);
          assert.equal(
            (
              await post("/reservations/verify", { reference: second.payment.reference }, b).expect(
                201,
              )
            ).body.status,
            "ACTIVE",
          );
        },
      );
      await t.test(
        "signed webhooks verify server-side and handle retries exactly once",
        async () => {
          const p = await makePlot("PAY-WEBHOOK");
          const row = (await post("/reservations/checkout", payload(p), c).expect(201)).body;
          paid(row.payment.reference);
          const body = JSON.stringify({
            event: "charge.success",
            data: { reference: row.payment.reference, amount: 1 },
          });
          const signature = require("node:crypto")
            .createHmac("sha512", "sk_test_integration")
            .update(body)
            .digest("hex");
          await api
            .post("/api/v1/payments/paystack/webhook")
            .set("Content-Type", "application/json")
            .set("x-paystack-signature", "0".repeat(128))
            .send(body)
            .expect(401);
          for (let i = 0; i < 2; i++)
            await api
              .post("/api/v1/payments/paystack/webhook")
              .set("Content-Type", "application/json")
              .set("x-paystack-signature", signature)
              .send(body)
              .expect(200);
          assert.equal(
            (await db.plotReservation.findUnique({ where: { id: row.id } })).status,
            "ACTIVE",
          );
          assert.equal(await db.buyerNotification.count({ where: { userId: c.id } }), 1);
        },
      );
      await t.test(
        "concurrent buyers cannot both obtain a checkout for the same plot",
        async () => {
          const p = await makePlot("PAY-RACE");
          const results = await Promise.all([
            post("/reservations/checkout", payload(p), a),
            post("/reservations/checkout", payload(p), b),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
          assert.equal(
            await db.plotReservation.count({ where: { plotId: p.id, status: "PENDING" } }),
            1,
          );
        },
      );
    } finally {
      if (app) await app.close();
      await admin.query("ROLLBACK");
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
