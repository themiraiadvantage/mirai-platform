const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");

test(
  "document management lifecycle in isolated PostgreSQL",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async (t) => {
    const { Client } = require("pg");
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = "mirai_documents_" + randomUUID().replaceAll("-", "");
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
      const docsOnly = await account("document-admin", "DOCUMENT_ADMINISTRATOR");
      const plot = await db.propertyPlot.create({
        data: {
          code: "DOC-001",
          title: "Epe plot",
          description: "Test listing",
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
          availability: "Reserved",
          details: {},
        },
      });
      await db.plotReservation.create({
        data: {
          plotId: plot.id,
          userId: a.id,
          amountKobo: 3000000n,
          accessMonths: 12,
          termsVersion: "test",
          acceptedAt: new Date(),
          snapshot: {},
          checkoutExpiresAt: new Date(Date.now() + 60000),
          status: "ACTIVE",
          accessExpiresAt: new Date(Date.now() + 86400000),
        },
      });
      const pdf = (text) => ({
        name: "survey.pdf",
        mime: "application/pdf",
        base64: Buffer.from("%PDF-1.4\n" + text).toString("base64"),
      });
      const fields = {
        plotId: plot.id,
        name: "Survey plan",
        category: "Survey plan",
        visibility: "Listing",
        buyerId: null,
        notes: "PRIVATE REVIEW NOTE",
      };
      let listing, assigned, internal;
      await t.test("requires Documents permission and real valid files", async () => {
        await api.get("/api/v1/admin/documents").expect(401);
        await get("/admin/documents", a).expect(403);
        await get("/admin/documents", limited).expect(403);
        await post("/admin/documents", fields, docsOnly).expect(400);
        await post(
          "/admin/documents",
          { ...fields, file: { ...pdf("x"), base64: Buffer.from("not a pdf").toString("base64") } },
          docsOnly,
        ).expect(400);
        listing = (
          await post("/admin/documents", { ...fields, file: pdf("original") }, docsOnly).expect(201)
        ).body;
        assert.equal(listing.recordVersion, 1);
        assert.equal(listing.fileVersion, 1);
        assert.equal(listing.data, undefined);
        const body = (await api.get(`/api/v1/plots/assets/${listing.id}`).expect(200)).body;
        assert.match(Buffer.from(body).toString(), /original/);
      });
      await t.test("uses real plot/buyer lookups and excludes ineligible recipients", async () => {
        assert.equal(
          (await get("/admin/documents/plots?q=DOC-001", docsOnly).expect(200)).body.items[0].id,
          plot.id,
        );
        assert.deepEqual(
          (
            await get(`/admin/documents/plots/${plot.id}/buyers`, docsOnly).expect(200)
          ).body.items.map((x) => x.id),
          [a.id],
        );
        await post(
          "/admin/documents",
          { ...fields, visibility: "Buyer only", buyerId: b.id, file: pdf("bad recipient") },
          docsOnly,
        ).expect(400);
        assigned = (
          await post(
            "/admin/documents",
            { ...fields, visibility: "Buyer only", buyerId: a.id, file: pdf("private buyer") },
            docsOnly,
          ).expect(201)
        ).body;
        internal = (
          await post(
            "/admin/documents",
            { ...fields, visibility: "Staff only", file: pdf("staff private") },
            docsOnly,
          ).expect(201)
        ).body;
        await api.get(`/api/v1/plots/assets/${assigned.id}`).expect(404);
        await get(`/documents/${internal.id}/download`, a).expect(404);
        await get(`/documents/${assigned.id}/download`, a).expect(200);
        assert.equal((await get("/documents", a).expect(200)).body.total, 1);
      });
      await t.test("shares uploads immediately only with the assigned buyer", async () => {
        assert.equal(assigned.reviewerName, undefined);
        assert.equal(assigned.reviewStatus, undefined);
        assert.equal(assigned.fileVersion, 1);
        const vault = (await get("/documents", a).expect(200)).body;
        assert.equal(vault.items[0].id, assigned.id);
        assert.equal(vault.items[0].notes, undefined);
        assert.equal(vault.items[0].recipientId, undefined);
        assert.equal((await get("/documents", b).expect(200)).body.total, 0);
        await get(`/documents/${assigned.id}/download`, a).expect(200);
        await get(`/documents/${assigned.id}/download`, b).expect(404);
        assert.equal(
          await db.buyerNotification.count({
            where: { userId: a.id, href: "/dashboard/documents" },
          }),
          1,
        );
        assert.equal(
          await db.activityEvent.count({
            where: { category: "DOCUMENTS", targetId: assigned.id },
          }),
          1,
        );
      });
      await t.test("keeps real file versions and rejects stale edits", async () => {
        const payload = { ...fields, version: listing.recordVersion, file: pdf("replacement") };
        listing = (await post(`/admin/documents/${listing.id}`, payload, docsOnly).expect(201))
          .body;
        assert.equal(listing.fileVersion, 2);
        await post(`/admin/documents/${listing.id}`, payload, docsOnly).expect(409);
        const detail = (await get(`/admin/documents/${listing.id}`, docsOnly).expect(200)).body;
        assert.deepEqual(
          detail.versions.map((v) => v.number),
          [2, 1],
        );
        assert.equal(detail.versions[0].data, undefined);
        const old = await get(
          `/admin/documents/${listing.id}/versions/1/download`,
          docsOnly,
        ).expect(200);
        const current = await get(`/admin/documents/${listing.id}/download`, docsOnly).expect(200);
        assert.match(Buffer.from(old.body).toString(), /original/);
        assert.match(Buffer.from(current.body).toString(), /replacement/);
        await get(`/admin/documents/${listing.id}/versions/1/download`, a).expect(403);
      });
      await t.test(
        "protects publication requirements and permanent allocation documents",
        async () => {
          await post(`/admin/documents/${listing.id}/remove`, {}, docsOnly).expect(409);
          await post(
            `/admin/documents/${listing.id}`,
            { ...fields, visibility: "Staff only", version: listing.recordVersion },
            docsOnly,
          ).expect(409);
          const match = await db.coMatch.create({
            data: {
              plotId: plot.id,
              status: "ALLOCATED",
              agreement: "Signed allocation agreement",
              notes: "",
            },
          });
          await db.coAllocation.create({
            data: {
              matchId: match.id,
              userId: a.id,
              portion: "Portion A",
              documentId: internal.id,
            },
          });
          await post(`/admin/documents/${internal.id}/remove`, {}, docsOnly).expect(409);
          await post(
            `/admin/documents/${internal.id}`,
            {
              ...fields,
              visibility: "Staff only",
              version: internal.recordVersion,
              file: pdf("tamper"),
            },
            docsOnly,
          ).expect(409);
          await get(`/co-ownership/assets/${internal.id}`, a).expect(200);
        },
      );
      await t.test(
        "filters saved records and removes unallocated files with their history",
        async () => {
          const page = (await get("/admin/documents?visibility=Buyer%20only", docsOnly).expect(200))
            .body;
          assert.equal(page.total, 1);
          assert.equal(page.stats.total, 3);
          assert.equal(
            (await get("/admin/documents?q=DOC-001", docsOnly).expect(200)).body.total,
            3,
          );
          await post(`/admin/documents/${assigned.id}/remove`, {}, docsOnly).expect(201);
          assert.equal(await db.documentVersion.count({ where: { assetId: assigned.id } }), 0);
          assert.equal((await get("/documents", a).expect(200)).body.total, 0);
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
