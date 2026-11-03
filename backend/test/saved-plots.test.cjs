const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");

test(
  "saved plots persist privately in isolated PostgreSQL",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async (t) => {
    const { Client } = require("pg");
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = "mirai_saved_" + randomUUID().replaceAll("-", "");
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
      const makePlot = (code, publication = "Published") =>
        db.propertyPlot.create({
          data: {
            code,
            title: `${code} Epe plot`,
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
            publication,
            availability: "Available",
            details: { notes: "PRIVATE INTERNAL NOTE" },
          },
        });
      const plot = await makePlot("SAVED-001"),
        draft = await makePlot("DRAFT-001", "Draft");
      await t.test(
        "requires customer auth and refuses unpublished plots or supplied actor IDs",
        async () => {
          await api.get("/api/v1/saved-plots").expect(401);
          await get("/saved-plots", owner).expect(403);
          await post("/saved-plots", { plotId: plot.id, saved: true, userId: b.id }, a).expect(400);
          await post("/saved-plots", { plotId: draft.id, saved: true }, a).expect(404);
        },
      );
      await t.test("saves idempotently without reserving or charging", async () => {
        const results = await Promise.all([
          post("/saved-plots", { plotId: plot.id, saved: true }, a),
          post("/saved-plots", { plotId: plot.id, saved: true }, a),
        ]);
        assert.deepEqual(
          results.map((r) => r.status),
          [201, 201],
        );
        assert.equal(await db.savedPlot.count({ where: { userId: a.id } }), 1);
        assert.equal(await db.plotReservation.count(), 0);
        assert.equal(await db.reservationPayment.count(), 0);
        assert.equal(
          (await db.propertyPlot.findUnique({ where: { id: plot.id } })).availability,
          "Available",
        );
      });
      await t.test("restores saved state from the database and isolates buyers", async () => {
        assert.deepEqual((await get("/saved-plots/ids", a).expect(200)).body.ids, [plot.id]);
        assert.equal((await get("/saved-plots", b).expect(200)).body.total, 0);
        const page = (await get("/saved-plots", a).expect(200)).body;
        assert.equal(page.items[0].plot.title, plot.title);
        assert.equal(page.items[0].plot.details, undefined);
        assert.equal(page.items[0].userId, undefined);
        assert.equal((await get("/saved-plots?state=Ogun", a).expect(200)).body.total, 0);
        assert.equal(
          (await get("/saved-plots?q=SAVED-001&state=Lagos", a).expect(200)).body.total,
          1,
        );
      });
      await t.test("shows current availability and hides withdrawn listing content", async () => {
        await db.propertyPlot.update({
          where: { id: plot.id },
          data: { availability: "Reserved" },
        });
        assert.equal(
          (await get("/saved-plots", a).expect(200)).body.items[0].plot.availability,
          "Reserved",
        );
        await db.propertyPlot.update({
          where: { id: plot.id },
          data: { publication: "Archived", title: "PRIVATE DRAFT TITLE" },
        });
        const row = (await get("/saved-plots", a).expect(200)).body.items[0];
        assert.equal(row.plot, null);
        assert.equal(row.plotId, plot.id);
        assert.equal((await get("/saved-plots?q=PRIVATE", a).expect(200)).body.total, 0);
      });
      await t.test("unsaving is idempotent and cannot remove another buyer's save", async () => {
        await post("/saved-plots", { plotId: plot.id, saved: false }, b).expect(201);
        assert.equal((await get("/saved-plots/ids", a).expect(200)).body.total, 1);
        for (let i = 0; i < 2; i++)
          await post("/saved-plots", { plotId: plot.id, saved: false }, a).expect(201);
        assert.equal((await get("/saved-plots", a).expect(200)).body.total, 0);
      });
    } finally {
      if (app) await app.close();
      await admin.query("ROLLBACK");
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
