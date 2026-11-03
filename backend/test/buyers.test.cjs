const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");

test(
  "buyers and ownership use real linked records in isolated PostgreSQL",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async (t) => {
    const { Client } = require("pg");
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = "mirai_buyers_" + randomUUID().replaceAll("-", "");
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
      const customersOnly = await account("customers-only", "ADMIN", ["customers"]);
      await db.user.update({ where: { id: c.id }, data: { emailVerifiedAt: null } });
      const makePlot = (code) =>
        db.propertyPlot.create({
          data: {
            code,
            title: "Epe land",
            description: "Listing",
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
            details: {},
          },
        });
      const p1 = await makePlot("BUY-001"),
        p2 = await makePlot("BUY-002");
      const reservation = await db.plotReservation.create({
        data: {
          userId: a.id,
          plotId: p1.id,
          status: "ACTIVE",
          amountKobo: 3000000n,
          accessMonths: 12,
          termsVersion: "test",
          acceptedAt: new Date(),
          snapshot: {},
          checkoutExpiresAt: new Date(Date.now() + 60000),
          accessExpiresAt: new Date(Date.now() + 86400000),
          payment: {
            create: {
              reference: randomUUID(),
              amountKobo: 3000000n,
              status: "SUCCESS",
              paidAt: new Date(),
            },
          },
        },
      });
      await db.plotReservation.create({
        data: {
          userId: b.id,
          plotId: p1.id,
          status: "FAILED",
          amountKobo: 3000000n,
          accessMonths: 12,
          termsVersion: "test",
          acceptedAt: new Date(),
          snapshot: {},
          checkoutExpiresAt: new Date(),
          payment: { create: { reference: randomUUID(), amountKobo: 3000000n, status: "FAILED" } },
        },
      });
      const policy = await db.coPolicy.create({
        data: { version: 1, title: "Terms", body: "Equal shares" },
      });
      const match = await db.coMatch.create({
        data: { plotId: p2.id, status: "ALLOCATED", agreement: "Signed agreement" },
      });
      const request = await db.coRequest.create({
        data: {
          userId: a.id,
          plotId: p2.id,
          policyId: policy.id,
          matchId: match.id,
          status: "ALLOCATED",
          offer: { total: 3000000 },
          preference: "",
          contributions: {
            create: { amount: 1000000, reference: randomUUID(), receivedAt: new Date() },
          },
        },
      });
      const document = await db.plotAsset.create({
        data: {
          plotId: p2.id,
          name: "Buyer deed.pdf",
          mime: "application/pdf",
          kind: "PRIVATE_DOCUMENT",
          data: Buffer.from("%PDF-1.4"),
          recipientId: a.id,
          notes: "PRIVATE DOCUMENT NOTES",
        },
      });
      await db.coAllocation.create({
        data: { matchId: match.id, userId: a.id, portion: "A", documentId: document.id },
      });
      await t.test(
        "lists customer accounts without staff and derives real counts and confirmed amounts",
        async () => {
          await api.get("/api/v1/admin/buyers").expect(401);
          await get("/admin/buyers", a).expect(403);
          await get("/admin/buyers", limited).expect(403);
          const page = (await get("/admin/buyers").expect(200)).body;
          assert.equal(page.total, 3);
          assert.equal(page.stats.verified, 2);
          assert.equal(page.stats.reserved, 1);
          assert.equal(page.stats.allocated, 1);
          const row = page.items.find((x) => x.id === a.id);
          assert.equal(row.activeReservations, 1);
          assert.equal(row.partnerships, 1);
          assert.equal(row.allocations, 1);
          assert.equal(row.confirmed, 1030000);
          assert.equal(page.items.find((x) => x.id === b.id).confirmed, 0);
          assert.equal(row.passwordHash, undefined);
          assert.equal(
            (await get("/admin/buyers?filter=unverified").expect(200)).body.items[0].id,
            c.id,
          );
          assert.equal((await get("/admin/buyers?filter=reserved").expect(200)).body.total, 1);
          assert.equal((await get("/admin/buyers?filter=allocated").expect(200)).body.total, 1);
        },
      );
      await t.test(
        "opens real linked reservations, payments, contributions, allocations and documents",
        async () => {
          const detail = (await get(`/admin/buyers/${a.id}`).expect(200)).body;
          assert.equal(detail.confirmedFees, 30000);
          assert.equal(detail.confirmedContributions, 1000000);
          assert.equal(detail.documents, 1);
          const paths = ["reservations", "payments", "contributions", "co-ownership", "documents"];
          for (const section of paths) {
            const rows = (await get(`/admin/buyers/${a.id}/records?section=${section}`).expect(200))
              .body;
            assert.equal(rows.total, 1);
            assert.equal(rows.items[0].reference, undefined);
            assert.equal(rows.items[0].notes, undefined);
          }
          assert.equal(
            (await get(`/admin/buyers/${b.id}/records?section=documents`).expect(200)).body.total,
            0,
          );
          await get(`/admin/buyers/${owner.id}`).expect(404);
        },
      );
      await t.test(
        "honours financial and document permissions even through customer details",
        async () => {
          const page = (await get("/admin/buyers", customersOnly).expect(200)).body;
          assert.equal(page.access.payments, false);
          assert.equal(page.items[0].confirmed, null);
          const detail = (await get(`/admin/buyers/${a.id}`, customersOnly).expect(200)).body;
          assert.equal(detail.confirmedFees, null);
          assert.equal(detail.confirmedContributions, null);
          assert.equal(detail.documents, null);
          for (const section of [
            "payments",
            "contributions",
            "documents",
            "reservations",
            "co-ownership",
          ])
            await get(`/admin/buyers/${a.id}/records?section=${section}`, customersOnly).expect(
              403,
            );
        },
      );
      await t.test(
        "saves contact details and private staff notes without changing login or ownership",
        async () => {
          const original = await db.user.findUnique({ where: { id: a.id } });
          const form = {
            name: "Paul Buyer",
            phone: "+234 801 234 5678",
            location: "Lagos",
            notes: "PRIVATE STAFF NOTE",
            version: 0,
          };
          await post(`/admin/buyers/${a.id}`, { ...form, email: "takeover@example.com" }).expect(
            400,
          );
          await post(`/admin/buyers/${a.id}`, { ...form, staffRole: "SUPER_ADMIN" }).expect(400);
          const result = (await post(`/admin/buyers/${a.id}`, form).expect(201)).body;
          assert.equal(result.version, 1);
          assert.equal(result.phone, form.phone);
          assert.equal(result.notes, form.notes);
          const saved = await db.user.findUnique({ where: { id: a.id } });
          assert.equal(saved.passwordHash, original.passwordHash);
          assert.equal(saved.email, original.email);
          assert.equal(saved.staffRole, null);
          assert.equal(
            (await db.plotReservation.findUnique({ where: { id: reservation.id } })).status,
            "ACTIVE",
          );
          assert.equal((await get("/admin/buyers?q=801").expect(200)).body.items[0].id, a.id);
          assert.equal(
            await db.activityEvent.count({ where: { category: "BUYERS", targetId: a.id } }),
            1,
          );
        },
      );
      await t.test(
        "buyer profile shares contact data while keeping staff notes private and handling stale edits",
        async () => {
          const profile = (await get("/profile", a).expect(200)).body;
          assert.equal(profile.name, "Paul Buyer");
          assert.equal(profile.notes, undefined);
          assert.equal(profile.phone, "+234 801 234 5678");
          await post(
            "/profile",
            {
              name: "Paul",
              phone: "08012345678",
              location: "Ogun",
              version: 1,
              notes: "erase staff note",
            },
            a,
          ).expect(400);
          const updated = (
            await post(
              "/profile",
              { name: "Paul Updated", phone: "08012345678", location: "Ogun", version: 1 },
              a,
            ).expect(201)
          ).body;
          assert.equal(updated.version, 2);
          assert.equal(updated.notes, undefined);
          const detail = (await get(`/admin/buyers/${a.id}`).expect(200)).body;
          assert.equal(detail.phone, "08012345678");
          assert.equal(detail.name, "Paul Updated");
          assert.equal(detail.notes, "PRIVATE STAFF NOTE");
          await post(`/admin/buyers/${a.id}`, {
            name: "Old profile",
            phone: "",
            location: "",
            notes: "",
            version: 1,
          }).expect(409);
          assert.equal((await get("/profile", b).expect(200)).body.phone, "");
        },
      );
      await t.test("paginates real accounts without duplicates", async () => {
        await db.user.createMany({
          data: Array.from({ length: 35 }, (_, i) => ({
            name: `Paginated ${i}`,
            email: `page-${i}@example.invalid`,
            passwordHash: "not-a-password",
          })),
        });
        const first = (await get("/admin/buyers?q=Paginated").expect(200)).body;
        assert.equal(first.items.length, 30);
        assert.equal(first.total, 35);
        assert.ok(first.nextCursor);
        const second = (
          await get(`/admin/buyers?q=Paginated&cursor=${first.nextCursor}`).expect(200)
        ).body;
        assert.equal(second.items.length, 5);
        assert.equal(new Set([...first.items, ...second.items].map((x) => x.id)).size, 35);
      });
    } finally {
      if (app) await app.close();
      await admin.query("ROLLBACK");
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
