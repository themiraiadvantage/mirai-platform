require("dotenv").config({ quiet: true });
async function main() {
  const args = process.argv.slice(2);
  const email = args.length === 2 && args[0] === "--email" ? args[1].trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Usage: npm run admin:bootstrap -- --email owner@example.com");
  const { NestFactory } = require("@nestjs/core");
  const { AppModule } = require("../dist/app.module");
  const { StaffService } = require("../dist/auth/staff.service");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
  try {
    const result = await app
      .get(StaffService)
      .invite({ email, name: "MIRAI Owner", role: "SUPER_ADMIN" }, null);
    console.log(result.message);
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(
    error.code ? "Owner setup failed. Check database connectivity and migrations." : error.message,
  );
  process.exitCode = 1;
});
