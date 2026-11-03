const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
require("dotenv/config");
test("signup accepts eight characters and requires every character category", () => {
  const { validateSync } = require("class-validator");
  const { SignupDto, LoginDto } = require("../dist/auth/dto");
  const validate = (password) =>
    validateSync(
      Object.assign(new SignupDto(), { name: "Buyer", email: "buyer@example.com", password }),
    );
  assert.equal(validate("Abcdef1!").length, 0);
  for (const password of ["Abcd1!x", "abcdef1!", "ABCDEF1!", "Abcdefg!", "Abcdef12", "Abcdef1 "])
    assert.ok(validate(password).length > 0);
  // Existing accounts can still log in using their original password.
  assert.equal(
    validateSync(
      Object.assign(new LoginDto(), { email: "buyer@example.com", password: "legacy-password" }),
    ).length,
    0,
  );
});

test("verification email escapes user content and includes matching plain text", () => {
  const { verificationEmail } = require("../dist/mail/templates");
  const email = verificationEmail(
    "<script>alert(1)</script>",
    "123456",
    "https://example.com/verify?token=test&other=value",
  );
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
  assert.ok(email.html.includes("#DF9F53"));
  assert.ok(email.text.includes("123456"));
  assert.ok(email.html.includes("123456"));
  assert.ok(email.html.includes("#00101A"));
  assert.ok(email.text.includes("10 minutes"));
  assert.ok(email.html.includes("token=test&amp;other=value"));
});

test("email branding embeds the supplied logo as an inline attachment", () => {
  const { verificationEmail } = require("../dist/mail/templates");
  const { withBrandLogo } = require("../dist/mail/brand");
  const message = withBrandLogo(verificationEmail("Buyer", "123456"));
  assert.ok(message.html.includes('src="cid:mirai-brand-logo"'));
  assert.ok(!message.html.includes("data:image/png;base64,"));
  assert.equal(message.attachments[0].cid, "mirai-brand-logo");
  assert.equal(message.attachments[0].contentType, "image/png");
  assert.ok(!message.html.includes("display:inline-block;background:#fff;padding:8px 12px"));
  assert.ok(message.html.includes('align="center" bgcolor="#00101A"'));
  assert.ok(
    message.attachments[0].content.equals(fs.readFileSync("assets/mirai-logo-white-email.png")),
  );
});

test(
  "HTTP authentication lifecycle against an isolated PostgreSQL schema",
  { skip: process.env.RUN_DATABASE_TESTS !== "1" },
  async (t) => {
    const { Client } = require("pg");
    const schema = `mirai_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await admin.connect();
    let app;
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      const sql = fs
        .readdirSync("prisma/migrations", { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .map((name) => fs.readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"))
        .join("\n")
        .replace(/^BEGIN;\r?$/gm, "")
        .replace(/^COMMIT;\r?$/gm, "")
        .replaceAll('"public"', `"${schema}"`);
      await admin.query("BEGIN");
      try {
        await admin.query(`SET LOCAL search_path TO "${schema}"`);
        await admin.query(sql);
        await admin.query("COMMIT");
      } catch (error) {
        await admin.query("ROLLBACK");
        throw error;
      }
      const url = new URL(process.env.DATABASE_URL);
      url.searchParams.set("schema", schema);
      process.env.DATABASE_URL = url.toString();
      process.env.NODE_ENV = "test";
      const { Test } = require("@nestjs/testing");
      const request = require("supertest");
      const { AppModule } = require("../dist/app.module");
      const { setupApp } = require("../dist/setup");
      const { MailService } = require("../dist/mail/mail.service");
      const { PrismaService } = require("../dist/database/prisma.service");
      const { ThrottlerStorage } = require("@nestjs/throttler");
      const emails = [];
      let failMail = false;
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(MailService)
        .useValue({
          sendVerification: async (email, name, token, code) => {
            if (failMail) {
              const { ServiceUnavailableException } = require("@nestjs/common");
              throw new ServiceUnavailableException();
            }
            emails.push({ email, name, token, code });
          },
        })
        .compile();
      app = module.createNestApplication();
      setupApp(app);
      await app.init();
      t.beforeEach(() => app.get(ThrottlerStorage).onApplicationShutdown());
      const api = request(app.getHttpServer());
      const db = app.get(PrismaService);
      const prefix = "/api/v1/auth";
      const credentials = { email: "buyer@example.com", password: "Abcdef1!" };
      let access, cookie, rotatedAccess, rotatedCookie;

      await t.test("rejects short passwords and privilege fields", async () => {
        await api
          .post(`${prefix}/signup`)
          .send({ ...credentials, name: "Test Buyer", password: "short" })
          .expect(400);
        await api
          .post(`${prefix}/signup`)
          .send({ ...credentials, name: "Test Buyer", role: "ADMIN" })
          .expect(400);
        assert.equal(await db.user.count(), 0);
      });
      await t.test(
        "normalizes email, hashes password, sends one verification and hides secrets",
        async () => {
          const response = await api
            .post(`${prefix}/signup`)
            .send({ ...credentials, email: " Buyer@Example.com ", name: "Test Buyer" })
            .expect(202);
          assert.ok(!JSON.stringify(response.body).includes("password"));
          const user = await db.user.findUnique({ where: { email: credentials.email } });
          assert.ok(user.passwordHash.startsWith("$argon2id$"));
          assert.notEqual(user.passwordHash, credentials.password);
          assert.equal(emails.length, 1);
          const record = await db.emailVerification.findUnique({ where: { userId: user.id } });
          assert.notEqual(record.tokenHash, emails[0].token);
          assert.match(emails[0].code, /^[0-9]{6}$/);
          assert.notEqual(record.codeHash, emails[0].code);
          assert.equal(record.attempts, 0);
          await api
            .post(`${prefix}/signup`)
            .send({ ...credentials, name: "Replacement", password: "Another-password-123" })
            .expect(202);
          await api
            .post(`${prefix}/resend-verification`)
            .send({ email: credentials.email })
            .expect(202);
          assert.equal(emails.length, 1);
          assert.equal((await db.user.findUnique({ where: { id: user.id } })).name, "Test Buyer");
        },
      );
      await t.test("rejects login before verification and invalid credentials", async () => {
        await api.post(`${prefix}/login`).send(credentials).expect(403);
        await api
          .post(`${prefix}/login`)
          .send({ ...credentials, password: "Incorrect-123456" })
          .expect(401);
        await api
          .post(`${prefix}/login`)
          .send({ ...credentials, email: "missing@example.com" })
          .expect(401);
      });
      await t.test("opening link does not consume token; confirming is single use", async () => {
        const token = emails[0].token;
        const page = await api.get(`${prefix}/verify-email`).query({ token }).expect(200);
        assert.ok(page.text.includes("Confirm my email"));
        assert.equal(
          (await db.user.findUnique({ where: { email: credentials.email } })).emailVerifiedAt,
          null,
        );
        const confirmed = await api
          .post(`${prefix}/verify-email/confirm`)
          .type("form")
          .send({ token })
          .expect(200);
        assert.ok(confirmed.text.includes("Continue to sign in"));
        assert.ok(confirmed.text.includes(new URL("/sign-in", process.env.FRONTEND_URL).href));
        await api.post(`${prefix}/verify-email`).send({ token }).expect(400);
      });
      await t.test(
        "login sets HttpOnly cookie and returns a safe profile and short-lived access token",
        async () => {
          const response = await api.post(`${prefix}/login`).send(credentials).expect(200);
          access = response.body.accessToken;
          cookie = response.headers["set-cookie"][0].split(";")[0];
          assert.ok(response.headers["set-cookie"][0].includes("HttpOnly"));
          assert.ok(response.headers["set-cookie"][0].includes("SameSite=Lax"));
          assert.equal(response.body.expiresIn, 900);
          assert.equal(response.body.refreshToken, undefined);
          assert.equal(response.body.user.passwordHash, undefined);
          await api.get(`${prefix}/me`).expect(401);
          await api.get(`${prefix}/me`).set("Authorization", `Bearer ${access}`).expect(200);
        },
      );
      await t.test(
        "refresh requires trusted origin, rotates session, and rejects old access",
        async () => {
          await api.post(`${prefix}/refresh`).set("Cookie", cookie).expect(403);
          await api
            .post(`${prefix}/refresh`)
            .set("Origin", "https://attacker.example")
            .set("Cookie", cookie)
            .expect(403);
          const response = await api
            .post(`${prefix}/refresh`)
            .set("Origin", process.env.FRONTEND_URL)
            .set("Cookie", cookie)
            .expect(200);
          rotatedAccess = response.body.accessToken;
          rotatedCookie = response.headers["set-cookie"][0].split(";")[0];
          assert.notEqual(rotatedCookie, cookie);
          await api.get(`${prefix}/me`).set("Authorization", `Bearer ${access}`).expect(401);
          await api.get(`${prefix}/me`).set("Authorization", `Bearer ${rotatedAccess}`).expect(200);
        },
      );
      await t.test("refresh-token replay revokes the session family", async () => {
        await api
          .post(`${prefix}/refresh`)
          .set("Origin", process.env.FRONTEND_URL)
          .set("Cookie", cookie)
          .expect(401);
        await api.get(`${prefix}/me`).set("Authorization", `Bearer ${rotatedAccess}`).expect(401);
        await api
          .post(`${prefix}/refresh`)
          .set("Origin", process.env.FRONTEND_URL)
          .set("Cookie", rotatedCookie)
          .expect(401);
      });
      await t.test("logout immediately revokes bearer access", async () => {
        const response = await api.post(`${prefix}/login`).send(credentials).expect(200);
        await api
          .post(`${prefix}/logout`)
          .set("Authorization", `Bearer ${response.body.accessToken}`)
          .expect(200);
        await api
          .get(`${prefix}/me`)
          .set("Authorization", `Bearer ${response.body.accessToken}`)
          .expect(401);
      });
      await t.test(
        "expired verification is rejected and resend invalidates the old token",
        async () => {
          await api
            .post(`${prefix}/signup`)
            .send({ ...credentials, email: "expiry@example.com", name: "Expiry Buyer" })
            .expect(202);
          const old = emails.at(-1).token;
          const user = await db.user.findUnique({ where: { email: "expiry@example.com" } });
          await db.emailVerification.update({
            where: { userId: user.id },
            data: { expiresAt: new Date(0), createdAt: new Date(0) },
          });
          await api.post(`${prefix}/verify-email`).send({ token: old }).expect(400);
          await api.post(`${prefix}/resend-verification`).send({ email: user.email }).expect(202);
          await api.post(`${prefix}/verify-email`).send({ token: old }).expect(400);
          await api
            .post(`${prefix}/verify-email`)
            .send({ token: emails.at(-1).token })
            .expect(200);
        },
      );
      await t.test("SMTP failure does not verify account and allows later recovery", async () => {
        failMail = true;
        await api
          .post(`${prefix}/signup`)
          .send({ ...credentials, email: "retry@example.com", name: "Retry Buyer" })
          .expect(503);
        const user = await db.user.findUnique({ where: { email: "retry@example.com" } });
        assert.equal(user.emailVerifiedAt, null);
        failMail = false;
        await api.post(`${prefix}/resend-verification`).send({ email: user.email }).expect(202);
        await api
          .post(`${prefix}/verify-email`)
          .send({ token: emails.at(-1).token })
          .expect(200);
      });
      await t.test("unknown and verified emails receive the same resend response", async () => {
        const missing = await api
          .post(`${prefix}/resend-verification`)
          .send({ email: "unknown@example.com" })
          .expect(202);
        const verified = await api
          .post(`${prefix}/resend-verification`)
          .send({ email: credentials.email })
          .expect(202);
        assert.deepEqual(missing.body, verified.body);
        await api.get("/api/v1/health").expect(200);
      });
      await t.test("email codes verify once and failed attempts are persisted", async () => {
        await api
          .post(`${prefix}/signup`)
          .send({ ...credentials, email: "code@example.com", name: "Code Buyer" })
          .expect(202);
        const message = emails.at(-1);
        const wrong = message.code === "000000" ? "111111" : "000000";
        await api
          .post(`${prefix}/verify-code`)
          .send({ email: message.email, code: wrong })
          .expect(400);
        const user = await db.user.findUnique({ where: { email: message.email } });
        assert.equal(
          (await db.emailVerification.findUnique({ where: { userId: user.id } })).attempts,
          1,
        );
        assert.equal(user.emailVerifiedAt, null);
        await api
          .post(`${prefix}/verify-code`)
          .send({ email: message.email, code: message.code })
          .expect(200);
        await api
          .post(`${prefix}/verify-code`)
          .send({ email: message.email, code: message.code })
          .expect(400);
      });
      await t.test("five wrong codes lock verification until resend", async () => {
        await api
          .post(`${prefix}/signup`)
          .send({ ...credentials, email: "locked-code@example.com", name: "Code Buyer" })
          .expect(202);
        const message = emails.at(-1);
        const wrong = message.code === "000000" ? "111111" : "000000";
        for (let i = 0; i < 5; i++)
          await api
            .post(`${prefix}/verify-code`)
            .send({ email: message.email, code: wrong })
            .expect(400);
        const blocked = await api
          .post(`${prefix}/verify-code`)
          .send({ email: message.email, code: message.code })
          .expect(400);
        assert.match(blocked.body.message, /Too many incorrect/);
        const user = await db.user.findUnique({ where: { email: message.email } });
        assert.equal(
          (await db.emailVerification.findUnique({ where: { userId: user.id } })).attempts,
          5,
        );
        await db.emailVerification.update({
          where: { userId: user.id },
          data: { createdAt: new Date(0) },
        });
        await api.post(`${prefix}/resend-verification`).send({ email: message.email }).expect(202);
        assert.equal(
          (await db.emailVerification.findUnique({ where: { userId: user.id } })).attempts,
          0,
        );
        await api
          .post(`${prefix}/verify-code`)
          .send({ email: message.email, code: emails.at(-1).code })
          .expect(200);
      });
      await t.test("expired codes and codes for a different email are rejected", async () => {
        await api
          .post(`${prefix}/signup`)
          .send({ ...credentials, email: "expired-code@example.com", name: "Code Buyer" })
          .expect(202);
        const message = emails.at(-1);
        await api
          .post(`${prefix}/verify-code`)
          .send({ email: "unknown-code@example.com", code: message.code })
          .expect(400);
        const user = await db.user.findUnique({ where: { email: message.email } });
        await db.emailVerification.update({
          where: { userId: user.id },
          data: { expiresAt: new Date(0) },
        });
        await api
          .post(`${prefix}/verify-code`)
          .send({ email: message.email, code: message.code })
          .expect(400);
        assert.equal((await db.user.findUnique({ where: { id: user.id } })).emailVerifiedAt, null);
      });
      await t.test("repeated login attempts are rate limited", async () => {
        for (let i = 0; i < 5; i++)
          await api
            .post(`${prefix}/login`)
            .send({ ...credentials, password: "Wrong-password-123" })
            .expect(401);
        await api.post(`${prefix}/login`).send(credentials).expect(429);
      });
      await t.test("concurrent resends issue a single new verification email", async () => {
        await api
          .post(`${prefix}/signup`)
          .send({ ...credentials, email: "parallel@example.com", name: "Parallel Buyer" })
          .expect(202);
        const user = await db.user.findUnique({ where: { email: "parallel@example.com" } });
        await db.emailVerification.update({
          where: { userId: user.id },
          data: { createdAt: new Date(0) },
        });
        const count = emails.length;
        await Promise.all(
          Array.from({ length: 3 }, () =>
            api.post(`${prefix}/resend-verification`).send({ email: user.email }).expect(202),
          ),
        );
        assert.equal(emails.length, count + 1);
        await api
          .post(`${prefix}/verify-email`)
          .send({ token: emails.at(-1).token })
          .expect(200);
      });
      await t.test("cross-origin sign-in is blocked", async () => {
        await api
          .post(`${prefix}/login`)
          .set("Origin", "https://attacker.example")
          .send(credentials)
          .expect(403);
      });
    } finally {
      if (app) await app.close();
      // This schema name is generated here, never accepted from an environment variable.
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
