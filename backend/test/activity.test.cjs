const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");
test(
  "settings changes and activity commit together, including concurrent saves",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async () => {
    const { Client } = require("pg");
    const schema = "mirai_activity_" + randomUUID().replaceAll("-", "");
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    let db;
    try {
      await admin.query('CREATE SCHEMA "' + schema + '"');
      const sql = fs
        .readdirSync("prisma/migrations", { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .map((name) => fs.readFileSync("prisma/migrations/" + name + "/migration.sql", "utf8"))
        .join("\n")
        .replace(/^BEGIN;\r?$/gm, "")
        .replace(/^COMMIT;\r?$/gm, "")
        .replaceAll('"public"', '"' + schema + '"');
      await admin.query("BEGIN");
      await admin.query('SET LOCAL search_path TO "' + schema + '"');
      await admin.query(sql);
      await admin.query("COMMIT");
      const url = new URL(process.env.DATABASE_URL);
      url.searchParams.set("schema", schema);
      process.env.DATABASE_URL = url.toString();
      process.env.NODE_ENV = "test";
      const { PrismaService } = require("../dist/database/prisma.service");
      const { WorkspaceSettingsService } = require("../dist/auth/settings.service");
      db = new PrismaService();
      await db.$connect();
      const user = await db.user.create({
        data: {
          email: "activity-owner@example.com",
          name: "Owner",
          passwordHash: "unused-test-value",
          staffRole: "SUPER_ADMIN",
          staffActive: true,
          emailVerifiedAt: new Date(),
        },
      });
      const service = new WorkspaceSettingsService(db);
      const initial = await service.get();
      const profile = {
        email: initial.email,
        phone: initial.phone,
        reservationFee: initial.reservationFee,
        accessMonths: initial.accessMonths,
      };
      await Promise.all([
        service.save(user.id, { ...profile, company: "Company A" }),
        service.save(user.id, { ...profile, company: "Company B" }),
      ]);
      const events = await db.activityEvent.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      assert.equal(events.length, 2);
      assert.equal(events[0].changes.company.before, initial.company);
      assert.equal(events[1].changes.company.before, events[0].changes.company.after);
      const confirmed = await service.get();
      assert.equal(confirmed.company, events[1].changes.company.after);
      await admin.query(
        'ALTER TABLE "' +
          schema +
          '"."ActivityEvent" ADD CONSTRAINT "test_event_failure" CHECK ("action" <> \'Workspace settings updated\') NOT VALID',
      );
      await assert.rejects(service.save(user.id, { ...profile, company: "Must roll back" }));
      assert.equal((await service.get()).company, confirmed.company);
      assert.equal(await db.activityEvent.count(), 2);
      await admin.query(
        'ALTER TABLE "' + schema + '"."ActivityEvent" DROP CONSTRAINT "test_event_failure"',
      );
    } finally {
      if (db) await db.$disconnect();
      await admin.query("ROLLBACK");
      await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      await admin.end();
    }
  },
);
