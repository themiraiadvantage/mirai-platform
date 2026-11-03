const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");

test(
  "plots and co-ownership lifecycle in isolated PostgreSQL",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async (t) => {
    const { Client } = require("pg");
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = "mirai_property_" + randomUUID().replaceAll("-", "");
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
      const { Test } = require("@nestjs/testing");
      const { ThrottlerStorage } = require("@nestjs/throttler");
      const { AppModule } = require("../dist/app.module");
      const { CloudinaryService } = require("../dist/property/cloudinary.service");
      const { PrismaService } = require("../dist/database/prisma.service");
      const { JwtService } = require("@nestjs/jwt");
      const { config } = require("../dist/config");
      const { setupApp } = require("../dist/setup");
      app = (
        await Test.createTestingModule({ imports: [AppModule] })
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
      ).createNestApplication();
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
      let plot, policy, ra, rb, rc, match, docA, docB;
      const fields = {
        code: "MR-REAL-1",
        title: "Epe 600 sqm",
        description: "A complete test listing with surveyed site evidence.",
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
        publication: "Draft",
        availability: "Available",
        verification: "verified",
        coEnabled: true,
        coMonths: 3,
        coDepositPercent: 10,
        details: {
          plans: ["Outright", "3mo"],
          latitude: 6.5,
          longitude: 3.5,
          siteStatus: "Site visit complete",
          docSummary: "Survey and title available",
          notes: "INTERNAL PRIVATE NOTE",
          beacons: [
            { id: "A", lat: 6.5, lng: 3.5 },
            { id: "B", lat: 6.501, lng: 3.5 },
            { id: "C", lat: 6.5, lng: 3.501 },
          ],
        },
      };
      const payload = (p, extra = {}) => ({ ...fields, version: p.version, ...extra });
      const pdf = {
        name: "survey.pdf",
        mime: "application/pdf",
        kind: "LISTING_DOCUMENT",
        base64: Buffer.from("%PDF-1.4\nTest document").toString("base64"),
      };
      await t.test(
        "requires permissions, validates drafts and keeps unpublished plots private",
        async () => {
          await api.get("/api/v1/admin/plots").expect(401);
          await get("/admin/plots", a).expect(403);
          await get("/admin/plots", limited).expect(403);
          await post("/admin/plots", { ...fields, actorId: a.id }).expect(400);
          const initialPublish = await post("/admin/plots", {
            ...fields,
            publication: "Published",
          }).expect(400);
          assert.deepEqual(
            initialPublish.body.publicationIssues.map((i) => i.code),
            ["draft", "photo", "document"],
          );
          plot = (await post("/admin/plots", fields).expect(201)).body;
          await api.get(`/api/v1/plots/${plot.code}`).expect(404);
          assert.equal((await api.get("/api/v1/plots").expect(200)).body.items.length, 0);
          await post("/admin/plots", fields).expect(409);
          await post(`/admin/plots/${plot.id}`, payload(plot, { version: 99 })).expect(409);
          plot = (
            await post(
              `/admin/plots/${plot.id}`,
              payload(plot, { size: 200, verification: "unchecked" }),
            ).expect(201)
          ).body;
          assert.equal(plot.coEnabled, true);
          assert.equal(plot.size, 200);
          assert.equal(plot.verification, "unchecked");
          plot = (await post(`/admin/plots/${plot.id}`, payload(plot)).expect(201)).body;
        },
      );
      await t.test(
        "stores actual files, rejects masqueraded files and publishes to buyer catalogue",
        async () => {
          await post(`/admin/plots/${plot.id}/assets`, { ...pdf, mime: "image/png" }).expect(400);
          await post(`/admin/plots/${plot.id}/assets`, pdf).expect(201);
          const photoMissing = await post(
            `/admin/plots/${plot.id}`,
            payload(plot, { publication: "Published" }),
          ).expect(400);
          assert.deepEqual(
            photoMissing.body.publicationIssues.map((i) => i.code),
            ["photo"],
          );
          assert.equal(photoMissing.body.publicationIssues[0].section, "Files");
          await post(`/admin/plots/${plot.id}/assets`, {
            name: "site.png",
            mime: "image/png",
            kind: "PHOTO",
            base64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString("base64"),
          }).expect(201);
          docA = (
            await post(`/admin/plots/${plot.id}/assets`, {
              ...pdf,
              name: "allocation-a.pdf",
              kind: "PRIVATE_DOCUMENT",
            }).expect(201)
          ).body;
          const storedPhoto = await db.plotAsset.findFirst({
            where: { plotId: plot.id, kind: "PHOTO" },
          });
          assert.equal(storedPhoto.data, null);
          assert.ok(storedPhoto.cloudinaryPublicId.startsWith("mirai/plots/"));
          await api.get(`/api/v1/plots/assets/${storedPhoto.id}`).expect(404);
          await get(`/admin/plots/assets/${storedPhoto.id}`).expect(302);
          docB = (
            await post(`/admin/plots/${plot.id}/assets`, {
              ...pdf,
              name: "allocation-b.pdf",
              kind: "PRIVATE_DOCUMENT",
            }).expect(201)
          ).body;
          plot = (
            await post(
              `/admin/plots/${plot.id}`,
              payload(plot, { publication: "Published" }),
            ).expect(201)
          ).body;
          const visible = (await api.get(`/api/v1/plots/${plot.code}`).expect(200)).body;
          assert.equal(visible.assets.length, 2);
          assert.equal(visible.details.notes, undefined);
          const photoResponse = await api.get(`/api/v1/plots/assets/${storedPhoto.id}`).expect(302);
          assert.match(photoResponse.headers.location, /^https:\/\/res\.cloudinary\.com\//);
          await api.get(`/api/v1/plots/assets/${docA.id}`).expect(404);
          await get(`/co-ownership/assets/${docA.id}`, a).expect(404);
          await api.get(`/api/v1/plots/assets/${visible.assets[0].id}`).expect(200);
          assert.equal((await api.get("/api/v1/co-ownership/offers")).body.items.length, 0);
        },
      );
      await t.test(
        "super admin publishes immutable terms; buyers submit idempotent real requests",
        async () => {
          const terms = {
            title: "Co-ownership agreement",
            body: "Both partners contribute equal shares. Allocation follows confirmed contributions and signed documentation.",
          };
          await post("/admin/co-ownership/policy", terms, staff).expect(403);
          policy = (await post("/admin/co-ownership/policy", terms).expect(201)).body;
          for (const change of [
            { verification: "unchecked" },
            { verification: "verified", size: 200 },
          ]) {
            plot = (
              await post(
                `/admin/plots/${plot.id}`,
                payload(plot, { publication: "Published", ...change }),
                staff,
              ).expect(201)
            ).body;
            assert.equal(plot.coEnabled, true);
            assert.equal(
              (await api.get("/api/v1/co-ownership/offers").expect(200)).body.items.length,
              0,
            );
            await post(
              "/co-ownership/requests",
              {
                plotId: plot.id,
                policyId: policy.id,
                version: plot.version,
                accepted: true,
                preference: "",
              },
              a,
            ).expect(409);
          }
          plot = (
            await post(
              `/admin/plots/${plot.id}`,
              payload(plot, { publication: "Published" }),
              staff,
            ).expect(201)
          ).body;
          const offers = (await api.get("/api/v1/co-ownership/offers").expect(200)).body;
          assert.equal(offers.items[0].id, plot.id);
          const request = {
            plotId: plot.id,
            policyId: policy.id,
            version: plot.version,
            accepted: true,
            preference: "Epe preferred",
          };
          await post("/co-ownership/requests", request, owner).expect(403);
          await post("/co-ownership/requests", { ...request, userId: b.id }, a).expect(400);
          await post("/co-ownership/requests", { ...request, version: 1 }, a).expect(409);
          ra = (await post("/co-ownership/requests", request, a).expect(201)).body;
          const retry = (await post("/co-ownership/requests", request, a).expect(201)).body;
          assert.equal(retry.id, ra.id);
          [rb, rc] = await Promise.all([
            post("/co-ownership/requests", request, b)
              .expect(201)
              .then((r) => r.body),
            post("/co-ownership/requests", request, c)
              .expect(201)
              .then((r) => r.body),
          ]);
          assert.equal(ra.offer.total, 3200000);
          assert.equal(ra.offer.deposit, 300000);
          assert.equal((await get("/co-ownership", a)).body.items.length, 1);
          assert.equal(await db.coContribution.count(), 0);
          const published = (
            await post("/admin/co-ownership/policy", {
              ...terms,
              body: terms.body + " New version.",
            }).expect(201)
          ).body;
          assert.equal(published.version, 2);
          assert.equal((await get("/co-ownership", a)).body.items[0].policy.version, 1);
        },
      );
      await t.test(
        "proposals reserve a single plot and do not expose partner email or internal notes",
        async () => {
          await post("/admin/co-ownership/matches", {
            firstRequestId: ra.id,
            secondRequestId: ra.id,
            agreement: "An agreement of sufficient length for both buyers.",
            notes: "",
          }).expect(409);
          const candidates = (
            await get(`/admin/co-ownership/requests/${ra.id}/candidates`).expect(200)
          ).body;
          assert.equal(candidates.items.length, 2);
          const proposal = {
            firstRequestId: ra.id,
            secondRequestId: rb.id,
            agreement:
              "Both partners accept equal contributions and separate surveyed portions after full payment.",
            notes: "INTERNAL MATCH NOTE",
          };
          const responses = await Promise.all([
            post("/admin/co-ownership/matches", proposal),
            post("/admin/co-ownership/matches", { ...proposal, secondRequestId: rc.id }),
          ]);
          assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
          match = responses.find((r) => r.status === 201).body;
          // Pick the actual paired requests after the concurrent proposal race.
          const paired = await db.coRequest.findMany({ where: { matchId: match.id } });
          rb = paired.find((r) => r.userId !== a.id); // rc remains the waiting request if b won, and vice versa.
          const result = (await get("/co-ownership", a).expect(200)).body.items[0];
          assert.equal(result.status, "PROPOSED");
          assert.equal(result.match.requests.length, 2);
          assert.equal(result.match.notes, undefined);
          assert.equal(result.match.requests[1].user.email, undefined);
          assert.equal(result.plot.details.notes, undefined);
          assert.equal(
            result.plot.assets.some((a) => a.kind === "PRIVATE_DOCUMENT"),
            false,
          );
          await post(
            `/admin/plots/${plot.id}`,
            payload(
              { version: plot.version + 1 },
              { publication: "Published", availability: "Available" },
            ),
          ).expect(409);
          await post("/admin/co-ownership/contributions", {
            requestId: ra.id,
            amount: 100,
            reference: "EARLY-PAY",
            receivedAt: new Date().toISOString(),
          }).expect(409);
        },
      );
      await t.test(
        "only each buyer can accept the current agreement; both accept before activation",
        async () => {
          const second = rb.userId === b.id ? b : c;
          await post(
            `/co-ownership/requests/${ra.id}/accept`,
            { matchId: match.id },
            second,
          ).expect(404);
          await post(`/co-ownership/requests/${ra.id}/accept`, { matchId: randomUUID() }, a).expect(
            409,
          );
          await post(`/co-ownership/requests/${ra.id}/accept`, { matchId: match.id }, a).expect(
            201,
          );
          assert.equal(
            (await db.coMatch.findUnique({ where: { id: match.id } })).status,
            "PROPOSED",
          );
          await post(
            `/co-ownership/requests/${rb.id}/accept`,
            { matchId: match.id },
            second,
          ).expect(201);
          await post(
            `/co-ownership/requests/${rb.id}/accept`,
            { matchId: match.id },
            second,
          ).expect(201);
          assert.equal((await db.coMatch.findUnique({ where: { id: match.id } })).status, "ACTIVE");
          await post(`/co-ownership/requests/${ra.id}/cancel`, {}, a).expect(409);
        },
      );
      await t.test(
        "contributions have unique references, retry safely and cannot overpay",
        async () => {
          const contribution = {
            requestId: ra.id,
            amount: 1000000,
            reference: "REAL-REF-1",
            receivedAt: new Date(Date.now() - 60000).toISOString(),
          };
          await post("/admin/co-ownership/contributions", contribution, a).expect(403);
          const [one, two] = await Promise.all([
            post("/admin/co-ownership/contributions", contribution).expect(201),
            post("/admin/co-ownership/contributions", contribution).expect(201),
          ]);
          assert.equal(one.body.id, two.body.id);
          assert.equal(await db.coContribution.count(), 1);
          await post("/admin/co-ownership/contributions", { ...contribution, amount: 1 }).expect(
            409,
          );
          await post("/admin/co-ownership/contributions", {
            ...contribution,
            reference: "TOO-MUCH",
            amount: 3000000,
          }).expect(400);
          await post("/admin/co-ownership/contributions", {
            ...contribution,
            reference: "FUTURE",
            receivedAt: new Date(Date.now() + 86400000).toISOString(),
          }).expect(400);
        },
      );
      await t.test(
        "allocation requires full contributions and private documents for the correct plot",
        async () => {
          const allocations = {
            portions: [
              { userId: a.id, portion: "Surveyed portion A, 300 sqm", documentId: docA.id },
              { userId: rb.userId, portion: "Surveyed portion B, 300 sqm", documentId: docB.id },
            ],
          };
          await post(`/admin/co-ownership/matches/${match.id}/allocate`, allocations).expect(409);
          for (const [id, amount, reference] of [
            [ra.id, 2200000, "REAL-REF-2"],
            [rb.id, 3200000, "REAL-REF-3"],
          ])
            await post("/admin/co-ownership/contributions", {
              requestId: id,
              amount,
              reference,
              receivedAt: new Date(Date.now() - 60000).toISOString(),
            }).expect(201);
          await post(`/admin/co-ownership/matches/${match.id}/allocate`, {
            portions: [
              allocations.portions[0],
              { ...allocations.portions[1], documentId: docA.id },
            ],
          }).expect(400);
          await post(`/admin/co-ownership/matches/${match.id}/allocate`, allocations).expect(201);
          const own = (await get("/co-ownership", a).expect(200)).body.items[0];
          assert.equal(own.status, "ALLOCATED");
          assert.equal(own.match.allocations.length, 1);
          assert.equal(own.match.allocations[0].documentId, docA.id);
          const summary = (await get("/co-ownership/summary", a).expect(200)).body;
          assert.equal(summary.allocated, 1);
          assert.equal(Number(summary.confirmed), 3200000);
          assert.deepEqual(summary.states, ["Lagos"]);
          await get(`/co-ownership/assets/${docA.id}`, a).expect(200);
          await get(`/co-ownership/assets/${docB.id}`, a).expect(404);
          await api.get(`/api/v1/plots/assets/${docA.id}`).expect(404);
          assert.equal(
            (await db.propertyPlot.findUnique({ where: { id: plot.id } })).availability,
            "Sold",
          );
        },
      );
      await t.test(
        "cancelling a proposal releases the plot and returns the other buyer to matching",
        async () => {
          const secondPlot = await db.propertyPlot.create({
            data: {
              ...fields,
              code: "MR-REAL-2",
              publication: "Published",
              availability: "Reserved",
            },
          });
          const proposal = await db.coMatch.create({
            data: {
              plotId: secondPlot.id,
              agreement: "Test agreement for cancellation and return to matching.",
            },
          });
          const first = await db.coRequest.create({
            data: {
              plotId: secondPlot.id,
              userId: a.id,
              policyId: policy.id,
              offer: ra.offer,
              preference: "",
              status: "PROPOSED",
              matchId: proposal.id,
              acceptedAt: new Date(),
            },
          });
          const other = await db.coRequest.create({
            data: {
              plotId: secondPlot.id,
              userId: b.id,
              policyId: policy.id,
              offer: ra.offer,
              preference: "",
              status: "PROPOSED",
              matchId: proposal.id,
            },
          });
          await post(`/co-ownership/requests/${first.id}/cancel`, {}, a).expect(201);
          assert.equal(
            (await db.coMatch.findUnique({ where: { id: proposal.id } })).status,
            "CANCELLED",
          );
          const returned = await db.coRequest.findUnique({ where: { id: other.id } });
          assert.equal(returned.status, "WAITING");
          assert.equal(returned.matchId, null);
          assert.equal(returned.acceptedAt, null);
          assert.equal(
            (await db.propertyPlot.findUnique({ where: { id: secondPlot.id } })).availability,
            "Available",
          );
          await post(
            `/co-ownership/requests/${first.id}/accept`,
            { matchId: proposal.id },
            a,
          ).expect(409);
          await post(`/admin/plots/assets/${docA.id}/remove`, {}).expect(409);
        },
      );
      await t.test(
        "live notifications, paginated records and audit events describe actual writes",
        async () => {
          const notifications = (await get("/notifications", a).expect(200)).body;
          assert.ok(
            notifications.items.some(
              (n) => n.kind === "activity" && n.announcement.title === "Your allocation is ready",
            ),
          );
          assert.equal(notifications.items[0].href, "/dashboard/co-own");
          await post(`/notifications/${notifications.items[0].id}/read`, {}, a).expect(201);
          const events = (await get("/admin/activity?category=CO_OWNERSHIP").expect(200)).body
            .items;
          assert.equal(events.filter((e) => e.action === "Contribution confirmed").length, 3);
          assert.equal(events.filter((e) => e.action === "Partner agreement accepted").length, 2);
          assert.ok(events.some((e) => e.action === "Co-ownership allocated"));
          assert.equal(
            (await get("/admin/co-ownership?status=ALLOCATED").expect(200)).body.items.length,
            2,
          );
          const unrelated = rb.userId === b.id ? c : b;
          const waiting = (await get("/co-ownership", unrelated).expect(200)).body.items[0];
          await post(`/co-ownership/requests/${waiting.id}/cancel`, {}, unrelated).expect(201);
          assert.equal((await get("/co-ownership", unrelated)).body.items[0].status, "CANCELLED");
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
