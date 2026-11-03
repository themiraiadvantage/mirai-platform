const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");

test(
  "owner setup, invited admins and access enforcement in isolated PostgreSQL",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async (t) => {
    const { Client } = require("pg");
    const schema = `mirai_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    let app;
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
      const { setupApp } = require("../dist/setup");
      const { MailService } = require("../dist/mail/mail.service");
      const { PrismaService } = require("../dist/database/prisma.service");
      const { StaffService } = require("../dist/auth/staff.service");
      const { tokenHash } = require("../dist/auth/auth.service");
      const request = require("supertest");
      const sent = [];
      let failMail = false;
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(MailService)
        .useValue({
          sendVerification: async () => {},
          sendStaffInvitation: async (email, name, role, token, owner) => {
            if (failMail) throw new Error("Mail unavailable");
            sent.push({ email, name, role, token, owner });
          },
        })
        .compile();
      app = module.createNestApplication();
      setupApp(app);
      await app.init();
      t.beforeEach(() => app.get(ThrottlerStorage).onApplicationShutdown());
      const api = request(app.getHttpServer()),
        db = app.get(PrismaService),
        service = app.get(StaffService);
      const auth = "/api/v1/auth",
        staff = "/api/v1/admin/auth",
        password = "MySecure1!";
      let ownerToken, ownerId, listingToken, listingId, buyerToken;
      const login = async (email, admin = true) => {
        const response = await api
          .post(`${auth}/${admin ? "admin/login" : "login"}`)
          .send({ email, password })
          .expect(200);
        assert.equal(response.body.user.passwordHash, undefined);
        assert.ok(response.headers["set-cookie"][0].includes("HttpOnly"));
        return response.body.accessToken;
      };
      await t.test(
        "first owner receives a single-use setup link, no default password or privilege before acceptance",
        async () => {
          await api.get(`${staff}/me`).expect(401);
          await service.invite(
            { email: "owner@example.com", name: "Owner", role: "SUPER_ADMIN" },
            null,
          );
          assert.equal(await db.user.count(), 0);
          assert.equal(sent.length, 1);
          assert.equal(sent[0].owner, true);
          const invite = await db.staffInvitation.findUnique({
            where: { email: "owner@example.com" },
          });
          assert.equal(invite.tokenHash, tokenHash(sent[0].token));
          assert.notEqual(invite.tokenHash, sent[0].token);
          await assert.rejects(
            service.invite(
              { email: "different@example.com", name: "Other", role: "SUPER_ADMIN" },
              null,
            ),
          );
          await api.post(`${auth}/admin/invitation`).send({ token: sent[0].token }).expect(200);
          await api
            .post(`${auth}/admin/accept-invitation`)
            .send({ token: sent[0].token, password: "weak" })
            .expect(400);
          await api
            .post(`${auth}/admin/accept-invitation`)
            .send({ token: sent[0].token, password, role: "SUPER_ADMIN" })
            .expect(400);
          await api
            .post(`${auth}/admin/accept-invitation`)
            .send({ token: sent[0].token, password })
            .expect(200);
          await api
            .post(`${auth}/admin/accept-invitation`)
            .send({ token: sent[0].token, password })
            .expect(400);
          const owner = await db.user.findUnique({ where: { email: "owner@example.com" } });
          ownerId = owner.id;
          assert.equal(owner.staffRole, "SUPER_ADMIN");
          assert.equal(owner.staffActive, true);
          assert.ok(owner.emailVerifiedAt);
          assert.ok(await require("argon2").verify(owner.passwordHash, password));
          ownerToken = await login("owner@example.com");
          const me = await api.get(`${staff}/me`).auth(ownerToken, { type: "bearer" }).expect(200);
          assert.ok(me.body.permissions.includes("staff"));
          await assert.rejects(
            service.invite(
              { email: "owner2@example.com", name: "Owner2", role: "SUPER_ADMIN" },
              null,
            ),
          );
        },
      );
      await t.test("buyers cannot enter admin, forge roles or manage invitations", async () => {
        const hash = await require("argon2").hash(password);
        await db.user.create({
          data: {
            email: "buyer@example.com",
            name: "Buyer",
            passwordHash: hash,
            emailVerifiedAt: new Date(),
          },
        });
        buyerToken = await login("buyer@example.com", false);
        await api.get(`${staff}/me`).auth(buyerToken, { type: "bearer" }).expect(403);
        await api
          .post(`${auth}/admin/login`)
          .send({ email: "buyer@example.com", password })
          .expect(403);
        await api
          .post(`${staff}/invitations`)
          .auth(buyerToken, { type: "bearer" })
          .send({ email: "x@example.com", name: "Not Owner", role: "SUPER_ADMIN" })
          .expect(403);
        await api
          .post(`${auth}/signup`)
          .send({
            email: "forged@example.com",
            name: "Forged",
            password,
            staffRole: "SUPER_ADMIN",
            staffActive: true,
          })
          .expect(400);
      });
      await t.test(
        "owner invites staff with database-enforced roles and no secrets in responses",
        async () => {
          const response = await api
            .post(`${staff}/invitations`)
            .auth(ownerToken, { type: "bearer" })
            .send({
              email: " Listing@Example.com ",
              name: "Listing Admin",
              role: "LISTING_MANAGER",
            })
            .expect(201);
          assert.ok(!JSON.stringify(response.body).includes(sent.at(-1).token));
          await api
            .post(`${auth}/admin/accept-invitation`)
            .send({ token: sent.at(-1).token, password })
            .expect(200);
          listingToken = await login("listing@example.com");
          const me = await api
            .get(`${staff}/me`)
            .auth(listingToken, { type: "bearer" })
            .expect(200);
          listingId = me.body.user.id;
          assert.ok(me.body.permissions.includes("plots"));
          assert.ok(!me.body.permissions.includes("staff"));
          await api.get(`${staff}/staff`).auth(listingToken, { type: "bearer" }).expect(403);
          await api
            .post(`${staff}/invitations`)
            .auth(listingToken, { type: "bearer" })
            .send({ email: "x@example.com", name: "Other", role: "SUPER_ADMIN" })
            .expect(403);
          const list = await api
            .get(`${staff}/staff`)
            .auth(ownerToken, { type: "bearer" })
            .expect(200);
          assert.equal(list.body.members.length, 2);
          assert.ok(!JSON.stringify(list.body).includes("tokenHash"));
        },
      );
      await t.test(
        "name and email alone invite a standard admin with operational access",
        async () => {
          await api
            .post(`${staff}/invitations`)
            .auth(ownerToken, { type: "bearer" })
            .send({ email: "simple@example.com", name: "Simple Admin" })
            .expect(201);
          const invitation = await db.staffInvitation.findUnique({
            where: { email: "simple@example.com" },
          });
          assert.equal(invitation.role, "ADMIN");
          assert.ok(invitation.permissions.includes("plots"));
          assert.ok(invitation.permissions.includes("payments"));
          assert.ok(!invitation.permissions.includes("staff"));
          await api
            .post(`${auth}/admin/accept-invitation`)
            .send({ token: sent.at(-1).token, password })
            .expect(200);
          const token = await login("simple@example.com");
          const me = await api.get(`${staff}/me`).auth(token, { type: "bearer" }).expect(200);
          assert.equal(me.body.user.staffRole, "ADMIN");
          assert.ok(me.body.permissions.includes("documents"));
          assert.ok(!me.body.permissions.includes("staff"));
          await api.get(`${staff}/staff`).auth(token, { type: "bearer" }).expect(403);
        },
      );
      await t.test(
        "workspace settings persist and only owners can change listing defaults",
        async () => {
          const path = staff + "/settings";
          const normalToken = await login("simple@example.com");
          await api.get(path).expect(401);
          await api.get(path).auth(buyerToken, { type: "bearer" }).expect(403);
          const first = await api.get(path).auth(ownerToken, { type: "bearer" }).expect(200);
          assert.equal(first.body.reservationFee, 30000);
          assert.equal(first.body.accessMonths, 12);
          const settings = {
            company: "MIRAI Platform",
            email: "support@example.com",
            phone: "+2348001234567",
            reservationFee: 45000,
            accessMonths: 18,
          };
          await api.post(path).auth(ownerToken, { type: "bearer" }).send(settings).expect(201);
          assert.equal(
            (await db.workspaceSettings.findUnique({ where: { id: "platform" } })).reservationFee,
            45000,
          );
          const read = await api.get(path).auth(normalToken, { type: "bearer" }).expect(200);
          assert.deepEqual(read.body, settings);
          const profile = { company: "MIRAI Updated", email: "team@example.com", phone: "" };
          await api
            .post(path)
            .auth(normalToken, { type: "bearer" })
            .send({ ...profile, reservationFee: 1 })
            .expect(403);
          await api
            .post(path)
            .auth(normalToken, { type: "bearer" })
            .send({ ...profile, accessMonths: 1 })
            .expect(403);
          const saved = await api
            .post(path)
            .auth(normalToken, { type: "bearer" })
            .send(profile)
            .expect(201);
          assert.equal(saved.body.reservationFee, 45000);
          assert.equal(saved.body.accessMonths, 18);
          const reload = await api.get(path).auth(ownerToken, { type: "bearer" }).expect(200);
          assert.deepEqual(reload.body, { ...settings, ...profile });
          await api.post(path).auth(listingToken, { type: "bearer" }).send(profile).expect(403);
          for (const invalid of [
            { reservationFee: -1 },
            { reservationFee: 1.5 },
            { accessMonths: 0 },
            { accessMonths: 121 },
            { accessMonths: 1.5 },
            { email: "bad" },
            { company: " " },
            { phone: "a".repeat(41) },
            { reservationFee: null },
          ]) {
            await api
              .post(path)
              .auth(ownerToken, { type: "bearer" })
              .send({ ...settings, ...invalid })
              .expect(400);
          }
          await api
            .post(path)
            .auth(ownerToken, { type: "bearer" })
            .send({ ...settings, staffRole: "SUPER_ADMIN" })
            .expect(400);
          const unchanged = await api.get(path).auth(ownerToken, { type: "bearer" }).expect(200);
          assert.deepEqual(unchanged.body, { ...settings, ...profile });
        },
      );
      await t.test(
        "announcements publish once to real buyer inboxes with isolated read status",
        async () => {
          const base = "/api/v1/admin/announcements";
          const inbox = "/api/v1/notifications";
          const normalToken = await login("simple@example.com");
          const originalBuyer = await db.user.findUnique({ where: { email: "buyer@example.com" } });
          const second = await db.user.create({
            data: {
              email: "second-buyer@example.com",
              name: "Second Buyer",
              passwordHash: originalBuyer.passwordHash,
              emailVerifiedAt: new Date(),
            },
          });
          const unverified = await db.user.create({
            data: {
              email: "unverified-buyer@example.com",
              name: "Unverified Buyer",
              passwordHash: originalBuyer.passwordHash,
            },
          });
          const secondToken = await login(second.email, false);
          await api.get(base).expect(401);
          await api.get(base).auth(buyerToken, { type: "bearer" }).expect(403);
          await api.get(base).auth(listingToken, { type: "bearer" }).expect(403);
          await api.get(inbox).expect(401);
          const available = await api
            .get(base + "/buyers?q=buyer")
            .auth(normalToken, { type: "bearer" })
            .expect(200);
          assert.ok(available.body.items.some((user) => user.id === second.id));
          assert.ok(!available.body.items.some((user) => user.id === unverified.id));
          assert.ok(
            available.body.items.every(
              (user) => Object.keys(user).sort().join(",") === "email,id,name",
            ),
          );
          const payload = {
            title: "  Service update  ",
            body: "First line.\nSecond line. <b>Plain text only</b>",
            audience: "ALL_BUYERS",
            buyerIds: [],
          };
          const created = await api
            .post(base)
            .auth(normalToken, { type: "bearer" })
            .send(payload)
            .expect(201);
          const id = created.body.id;
          assert.equal(created.body.status, "DRAFT");
          assert.equal(created.body.title, "Service update");
          assert.equal(
            (await api.get(inbox).auth(buyerToken, { type: "bearer" }).expect(200)).body.items
              .length,
            0,
          );
          await api
            .post(base)
            .auth(normalToken, { type: "bearer" })
            .send({ ...payload, status: "PUBLISHED" })
            .expect(400);
          await api
            .post(base)
            .auth(normalToken, { type: "bearer" })
            .send({ ...payload, title: " " })
            .expect(400);
          await api
            .post(base)
            .auth(normalToken, { type: "bearer" })
            .send({ ...payload, audience: "SELECTED_BUYERS", buyerIds: [] })
            .expect(400);
          await api
            .post(base)
            .auth(normalToken, { type: "bearer" })
            .send({ ...payload, audience: "SELECTED_BUYERS", buyerIds: [ownerId] })
            .expect(400);
          await api
            .post(base)
            .auth(normalToken, { type: "bearer" })
            .send({ ...payload, audience: "SELECTED_BUYERS", buyerIds: [second.id, second.id] })
            .expect(400);
          const edited = await api
            .post(base + "/" + id)
            .auth(normalToken, { type: "bearer" })
            .send({ ...payload, title: "Updated service notice" })
            .expect(201);
          assert.equal(edited.body.title, "Updated service notice");
          await Promise.all([
            api
              .post(base + "/" + id + "/publish")
              .auth(normalToken, { type: "bearer" })
              .expect(201),
            api
              .post(base + "/" + id + "/publish")
              .auth(normalToken, { type: "bearer" })
              .expect(201),
          ]);
          const buyerCount = await db.user.count({
            where: { staffRole: null, emailVerifiedAt: { not: null } },
          });
          assert.equal(
            await db.buyerNotification.count({ where: { announcementId: id } }),
            buyerCount,
          );
          const firstInbox = (await api.get(inbox).auth(buyerToken, { type: "bearer" }).expect(200))
            .body;
          const secondInbox = (
            await api.get(inbox).auth(secondToken, { type: "bearer" }).expect(200)
          ).body;
          assert.equal(firstInbox.unreadCount, 1);
          assert.equal(secondInbox.unreadCount, 1);
          assert.equal(firstInbox.items[0].announcement.body, payload.body);
          assert.equal(firstInbox.items[0].announcement.title, "Updated service notice");
          assert.ok(!JSON.stringify(firstInbox).includes("authorId"));
          const ownNotice = firstInbox.items[0].id;
          await api
            .post(inbox + "/" + ownNotice + "/read")
            .auth(secondToken, { type: "bearer" })
            .expect(404);
          const marked = (
            await api
              .post(inbox + "/" + ownNotice + "/read")
              .auth(buyerToken, { type: "bearer" })
              .expect(201)
          ).body;
          assert.equal(marked.unreadCount, 0);
          assert.ok(marked.notification.readAt);
          await api
            .post(inbox + "/" + ownNotice + "/read")
            .auth(buyerToken, { type: "bearer" })
            .expect(201);
          assert.equal(
            (await api.get(inbox).auth(secondToken, { type: "bearer" }).expect(200)).body
              .unreadCount,
            1,
          );
          await api
            .get(inbox + "?cursor=" + ownNotice)
            .auth(secondToken, { type: "bearer" })
            .expect(400);
          const targeted = (
            await api
              .post(base)
              .auth(ownerToken, { type: "bearer" })
              .send({
                ...payload,
                title: "For the second buyer",
                audience: "SELECTED_BUYERS",
                buyerIds: [second.id],
              })
              .expect(201)
          ).body;
          await api
            .post(base + "/" + targeted.id + "/publish")
            .auth(ownerToken, { type: "bearer" })
            .expect(201);
          assert.equal(
            (await api.get(inbox).auth(buyerToken, { type: "bearer" }).expect(200)).body.items
              .length,
            1,
          );
          assert.equal(
            (await api.get(inbox).auth(secondToken, { type: "bearer" }).expect(200)).body
              .unreadCount,
            2,
          );
          const allRead = (
            await api
              .post(inbox + "/read-all")
              .auth(secondToken, { type: "bearer" })
              .expect(201)
          ).body;
          assert.equal(allRead.unreadCount, 0);
          assert.ok(
            (
              await api.get(inbox).auth(secondToken, { type: "bearer" }).expect(200)
            ).body.items.every((item) => item.readAt),
          );
          await api
            .post(base + "/" + id)
            .auth(normalToken, { type: "bearer" })
            .send(payload)
            .expect(409);
          const report = (
            await api
              .get(base + "?status=PUBLISHED")
              .auth(normalToken, { type: "bearer" })
              .expect(200)
          ).body;
          assert.equal(report.items.find((item) => item.id === id).recipientCount, buyerCount);
          assert.equal(report.items.find((item) => item.id === id).readCount, 2);
          assert.ok(report.items.every((item) => item.status === "PUBLISHED"));
          const actor = await db.user.findUnique({ where: { email: "simple@example.com" } });
          await db.user.update({
            where: { id: actor.id },
            data: { staffPermissions: ["dashboard"] },
          });
          await api.post(base).auth(normalToken, { type: "bearer" }).send(payload).expect(403);
          await db.user.update({
            where: { id: actor.id },
            data: { staffPermissions: actor.staffPermissions },
          });
          const rows = Array.from({ length: 25 }, (_, i) => ({
            id: randomUUID(),
            title: "Earlier notice " + i,
            body: "A saved update",
            audience: "ALL_BUYERS",
            buyerIds: [],
            status: "PUBLISHED",
            authorId: ownerId,
            publishedAt: new Date(Date.now() - 1000 - i),
          }));
          await db.announcement.createMany({ data: rows });
          await db.buyerNotification.createMany({
            data: rows.map((row) => ({
              id: randomUUID(),
              userId: originalBuyer.id,
              announcementId: row.id,
              createdAt: row.publishedAt,
            })),
          });
          const firstPage = (await api.get(inbox).auth(buyerToken, { type: "bearer" }).expect(200))
            .body;
          assert.equal(firstPage.items.length, 20);
          assert.ok(firstPage.nextCursor);
          assert.equal(firstPage.unreadCount, 25);
          const lastPage = (
            await api
              .get(inbox + "?cursor=" + firstPage.nextCursor)
              .auth(buyerToken, { type: "bearer" })
              .expect(200)
          ).body;
          assert.equal(lastPage.items.length, 6);
          assert.equal(lastPage.nextCursor, null);
          assert.ok(
            !lastPage.items.some((item) => firstPage.items.some((first) => first.id === item.id)),
          );
          await api
            .post(inbox + "/read-all")
            .auth(buyerToken, { type: "bearer" })
            .expect(201);
          assert.equal(
            (await api.get(inbox).auth(buyerToken, { type: "bearer" }).expect(200)).body
              .unreadCount,
            0,
          );
        },
      );
      await t.test(
        "activity history records real changes, protects access, and is append-only",
        async () => {
          const path = "/api/v1/admin/activity";
          await api.get(path).expect(401);
          await api.get(path).auth(buyerToken, { type: "bearer" }).expect(403);
          await api.get(path).auth(listingToken, { type: "bearer" }).expect(403);
          const history = (await api.get(path).auth(ownerToken, { type: "bearer" }).expect(200))
            .body;
          assert.ok(history.total > 0);
          assert.ok(history.items.some((row) => row.action === "Staff invitation created"));
          assert.ok(history.items.some((row) => row.action === "Workspace settings updated"));
          assert.ok(history.items.some((row) => row.action === "Admin signed in"));
          const encoded = JSON.stringify(history);
          for (const secret of [
            "passwordHash",
            "refreshTokenHash",
            "tokenHash",
            password,
            ...sent.map((message) => message.token),
          ])
            assert.ok(!encoded.includes(secret));
          assert.ok(history.items.every((row) => row.createdAt && row.actorName && row.actorRole));
          const announcement = await db.announcement.findFirst({
            where: { title: "Updated service notice" },
          });
          assert.equal(
            await db.activityEvent.count({
              where: { action: "Announcement published", targetId: announcement.id },
            }),
            1,
          );
          const settings = await db.workspaceSettings.findUnique({ where: { id: "platform" } });
          const payload = {
            company: settings.company,
            email: settings.email,
            phone: settings.phone,
            reservationFee: settings.reservationFee,
            accessMonths: settings.accessMonths,
          };
          const count = await db.activityEvent.count();
          await api
            .post(staff + "/settings")
            .auth(ownerToken, { type: "bearer" })
            .send(payload)
            .expect(201);
          assert.equal(await db.activityEvent.count(), count);
          await api
            .post(staff + "/settings")
            .auth(ownerToken, { type: "bearer" })
            .send({ ...payload, reservationFee: -1 })
            .expect(400);
          assert.equal(await db.activityEvent.count(), count);
          const settingsLogs = (
            await api
              .get(path + "?category=SETTINGS&q=MIRAI")
              .auth(ownerToken, { type: "bearer" })
              .expect(200)
          ).body;
          assert.ok(settingsLogs.items.length > 0);
          assert.ok(settingsLogs.items.every((row) => row.category === "SETTINGS"));
          assert.ok(
            settingsLogs.items.some((row) => row.changes && Object.keys(row.changes).length),
          );
          for (const invalid of [
            "category=UNKNOWN",
            "from=bad-date",
            "from=2030-01-01&to=2020-01-01",
            "actorId=" + ownerId,
            "cursor=bad-id",
          ])
            await api
              .get(path + "?" + invalid)
              .auth(ownerToken, { type: "bearer" })
              .expect(400);
          await api
            .post(path)
            .auth(ownerToken, { type: "bearer" })
            .send({ action: "Forged event", actorName: "Owner" })
            .expect(404);
          const event = history.items[0];
          await assert.rejects(
            admin.query(`UPDATE "${schema}"."ActivityEvent" SET "action" = $1 WHERE "id" = $2`, [
              "Changed",
              event.id,
            ]),
            /Activity events cannot be edited or deleted/,
          );
          await assert.rejects(
            admin.query(`DELETE FROM "${schema}"."ActivityEvent" WHERE "id" = $1`, [event.id]),
            /Activity events cannot be edited or deleted/,
          );
          assert.equal(
            (await db.activityEvent.findUnique({ where: { id: event.id } })).action,
            event.action,
          );
          const normal = await db.user.findUnique({ where: { email: "simple@example.com" } });
          const normalToken = await login(normal.email);
          await api.get(path).auth(normalToken, { type: "bearer" }).expect(200);
          await service.setPermissions(ownerId, normal.id, {
            role: "ADMIN",
            permissions: ["dashboard"],
          });
          await api.get(path).auth(normalToken, { type: "bearer" }).expect(403);
          await service.setPermissions(ownerId, normal.id, {
            role: "ADMIN",
            permissions: normal.staffPermissions,
          });
          await api
            .post(auth + "/logout")
            .auth(normalToken, { type: "bearer" })
            .expect(200);
          assert.equal(
            await db.activityEvent.count({
              where: { actorId: normal.id, action: "Admin signed out" },
            }),
            1,
          );
          const records = Array.from({ length: 55 }, (_, index) => ({
            id: randomUUID(),
            category: "AUTH",
            action: "Pagination fixture",
            actorName: "Test actor",
            actorRole: "ADMIN",
            targetLabel: "Pagination fixture " + index,
            detail: "Isolated test event",
            createdAt: new Date(Date.UTC(2026, 10, 1, 12, 0, index)),
          }));
          await db.activityEvent.createMany({ data: records });
          const first = (
            await api
              .get(
                path + "?q=Pagination%20fixture&from=2026-11-01T00:00:00Z&to=2026-11-01T23:59:59Z",
              )
              .auth(ownerToken, { type: "bearer" })
              .expect(200)
          ).body;
          assert.equal(first.total, 55);
          assert.equal(first.items.length, 50);
          assert.ok(first.nextCursor);
          const last = (
            await api
              .get(path + "?q=Pagination%20fixture&cursor=" + first.nextCursor)
              .auth(ownerToken, { type: "bearer" })
              .expect(200)
          ).body;
          assert.equal(last.items.length, 5);
          assert.equal(last.nextCursor, null);
          assert.ok(
            !last.items.some((row) => first.items.some((previous) => previous.id === row.id)),
          );
        },
      );
      await t.test("custom invitations activate only the selected sections", async () => {
        const response = await api
          .post(`${staff}/invitations`)
          .auth(ownerToken, { type: "bearer" })
          .send({
            email: "custom@example.com",
            name: "Custom Admin",
            role: "LISTING_MANAGER",
            permissions: ["documents", "payments"],
          })
          .expect(201);
        assert.ok(!JSON.stringify(response.body).includes(sent.at(-1).token));
        const token = sent.at(-1).token;
        const pending = await api.post(`${auth}/admin/invitation`).send({ token }).expect(200);
        assert.deepEqual(pending.body.permissions, ["dashboard", "documents", "payments"]);
        await api.post(`${auth}/admin/accept-invitation`).send({ token, password }).expect(200);
        const customToken = await login("custom@example.com");
        const me = await api.get(`${staff}/me`).auth(customToken, { type: "bearer" }).expect(200);
        assert.deepEqual(me.body.permissions, ["dashboard", "documents", "payments"]);
        await api.get(`${staff}/staff`).auth(customToken, { type: "bearer" }).expect(403);
      });
      await t.test("all operational access does not grant staff administration", async () => {
        const { STAFF_SECTIONS } = require("../dist/auth/staff-permissions");
        await api
          .post(`${staff}/invitations`)
          .auth(ownerToken, { type: "bearer" })
          .send({
            email: "all@example.com",
            name: "All Operations",
            role: "DOCUMENT_ADMINISTRATOR",
            permissions: [...STAFF_SECTIONS],
          })
          .expect(201);
        await api
          .post(`${auth}/admin/accept-invitation`)
          .send({ token: sent.at(-1).token, password })
          .expect(200);
        const token = await login("all@example.com");
        const me = await api.get(`${staff}/me`).auth(token, { type: "bearer" }).expect(200);
        assert.ok(me.body.permissions.includes("payments"));
        assert.ok(me.body.permissions.includes("plots"));
        assert.ok(me.body.permissions.includes("settings"));
        assert.ok(!me.body.permissions.includes("staff"));
        await api
          .post(`${staff}/staff/${listingId}/permissions`)
          .auth(token, { type: "bearer" })
          .send({ role: "SUPER_ADMIN" })
          .expect(403);
      });
      await t.test(
        "permissions can change for an existing admin and old tokens see the new selection",
        async () => {
          await api
            .post(`${staff}/staff/${listingId}/permissions`)
            .auth(ownerToken, { type: "bearer" })
            .send({ role: "PAYMENT_SUPPORT", permissions: ["documents", "announcements"] })
            .expect(201);
          const me = await api
            .get(`${staff}/me`)
            .auth(listingToken, { type: "bearer" })
            .expect(200);
          assert.equal(me.body.user.staffRole, "PAYMENT_SUPPORT");
          assert.deepEqual(me.body.permissions, ["dashboard", "documents", "announcements"]);
          const stored = await db.user.findUnique({ where: { id: listingId } });
          assert.deepEqual(stored.staffPermissions, me.body.permissions);
          await api
            .post(`${staff}/staff/${listingId}/permissions`)
            .auth(listingToken, { type: "bearer" })
            .send({ role: "SUPER_ADMIN" })
            .expect(403);
          await api
            .post(`${staff}/staff/${ownerId}/permissions`)
            .auth(ownerToken, { type: "bearer" })
            .send({ role: "LISTING_MANAGER", permissions: ["dashboard"] })
            .expect(400);
        },
      );
      await t.test(
        "unknown, duplicate and staff-management permission keys are rejected",
        async () => {
          for (const permissions of [["staff"], ["unknown"], ["plots", "plots"], "plots"]) {
            await api
              .post(`${staff}/staff/${listingId}/permissions`)
              .auth(ownerToken, { type: "bearer" })
              .send({ role: "LISTING_MANAGER", permissions })
              .expect(400);
          }
          await api
            .post(`${staff}/invitations`)
            .auth(ownerToken, { type: "bearer" })
            .send({
              email: "invalid@example.com",
              name: "Invalid Admin",
              role: "LISTING_MANAGER",
              permissions: ["staff"],
            })
            .expect(400);
          assert.equal(await db.user.count({ where: { email: "invalid@example.com" } }), 0);
        },
      );
      await t.test(
        "overview-only access and explicit Super Admin promotion remain distinct",
        async () => {
          await api
            .post(`${staff}/staff/${listingId}/permissions`)
            .auth(ownerToken, { type: "bearer" })
            .send({ role: "LISTING_MANAGER", permissions: ["dashboard"] })
            .expect(201);
          let me = await api.get(`${staff}/me`).auth(listingToken, { type: "bearer" }).expect(200);
          assert.deepEqual(me.body.permissions, ["dashboard"]);
          await api
            .post(`${staff}/staff/${listingId}/permissions`)
            .auth(ownerToken, { type: "bearer" })
            .send({ role: "SUPER_ADMIN", permissions: ["dashboard"] })
            .expect(201);
          me = await api.get(`${staff}/me`).auth(listingToken, { type: "bearer" }).expect(200);
          assert.ok(me.body.permissions.includes("staff"));
          await api.get(`${staff}/staff`).auth(listingToken, { type: "bearer" }).expect(200);
          await api
            .post(`${staff}/staff/${listingId}/permissions`)
            .auth(ownerToken, { type: "bearer" })
            .send({ role: "LISTING_MANAGER", permissions: ["plots"] })
            .expect(201);
          me = await api.get(`${staff}/me`).auth(listingToken, { type: "bearer" }).expect(200);
          assert.ok(!me.body.permissions.includes("staff"));
        },
      );
      await t.test("suspension revokes sessions immediately, own access is protected", async () => {
        await api
          .post(`${staff}/staff/${ownerId}/access`)
          .auth(ownerToken, { type: "bearer" })
          .send({ active: false })
          .expect(400);
        await api
          .post(`${staff}/staff/${listingId}/access`)
          .auth(ownerToken, { type: "bearer" })
          .send({ active: false })
          .expect(201);
        await api.get(`${staff}/me`).auth(listingToken, { type: "bearer" }).expect(401);
        await api
          .post(`${auth}/admin/login`)
          .send({ email: "listing@example.com", password })
          .expect(403);
        await api
          .post(`${staff}/staff/${listingId}/access`)
          .auth(ownerToken, { type: "bearer" })
          .send({ active: true })
          .expect(201);
        listingToken = await login("listing@example.com");
        await db.user.update({ where: { id: listingId }, data: { staffActive: false } });
        await api.get(`${staff}/me`).auth(listingToken, { type: "bearer" }).expect(403);
      });
      await t.test(
        "expired links and invitations from suspended owners cannot activate access",
        async () => {
          await service.invite(
            { email: "pending@example.com", name: "Pending", role: "DOCUMENT_ADMINISTRATOR" },
            ownerId,
          );
          const token = sent.at(-1).token;
          await db.staffInvitation.update({
            where: { email: "pending@example.com" },
            data: { expiresAt: new Date(0) },
          });
          await api.post(`${auth}/admin/accept-invitation`).send({ token, password }).expect(400);
          await db.staffInvitation.update({
            where: { email: "pending@example.com" },
            data: { expiresAt: new Date(Date.now() + 60000) },
          });
          await db.user.update({ where: { id: ownerId }, data: { staffActive: false } });
          await api.post(`${auth}/admin/accept-invitation`).send({ token, password }).expect(403);
          assert.equal(await db.user.count({ where: { email: "pending@example.com" } }), 0);
          await db.user.update({ where: { id: ownerId }, data: { staffActive: true } });
        },
      );
      await t.test("resend invalidates the old link; failed mail can be retried", async () => {
        await service.invite(
          { email: "resend@example.com", name: "Resend", role: "PAYMENT_SUPPORT" },
          ownerId,
        );
        const old = sent.at(-1).token;
        await db.staffInvitation.update({
          where: { email: "resend@example.com" },
          data: { createdAt: new Date(0) },
        });
        failMail = true;
        await assert.rejects(
          service.invite(
            { email: "resend@example.com", name: "Resend", role: "PAYMENT_SUPPORT" },
            ownerId,
          ),
        );
        failMail = false;
        await service.invite(
          { email: "resend@example.com", name: "Resend", role: "PAYMENT_SUPPORT" },
          ownerId,
        );
        await api.post(`${auth}/admin/invitation`).send({ token: old }).expect(400);
        await api
          .post(`${auth}/admin/accept-invitation`)
          .send({ token: sent.at(-1).token, password })
          .expect(200);
      });
      await t.test(
        "inviting an existing buyer preserves their data and revokes their old session on activation",
        async () => {
          const original = await db.user.findUnique({ where: { email: "buyer@example.com" } });
          await service.invite(
            { email: "buyer@example.com", name: "Invited Buyer", role: "DOCUMENT_ADMINISTRATOR" },
            ownerId,
          );
          await api
            .post(`${auth}/admin/accept-invitation`)
            .send({ token: sent.at(-1).token, password: "ChangedPassword1!" })
            .expect(200);
          const updated = await db.user.findUnique({ where: { email: "buyer@example.com" } });
          assert.equal(updated.id, original.id);
          assert.equal(updated.name, original.name);
          await api.get(`${auth}/me`).auth(buyerToken, { type: "bearer" }).expect(401);
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
