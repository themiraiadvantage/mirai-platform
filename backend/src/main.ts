import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, raw, urlencoded } from "express";
import { AppModule } from "./app.module";
import { setupApp } from "./setup";
import { config } from "./config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Authenticate the exact webhook bytes before trusting any payment event.
  app.use(
    "/api/v1/payments/paystack/webhook",
    raw({ type: "application/json", limit: "128kb" }),
    (
      req: import("@nestjs/common").RawBodyRequest<import("express").Request>,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => {
      req.rawBody = req.body;
      try {
        req.body = JSON.parse(req.rawBody?.toString("utf8") || "{}");
        next();
      } catch {
        res.status(400).json({ message: "Invalid webhook JSON." });
      }
    },
  );
  // Long announcement text and a bounded recipient list need more space than auth forms.
  app.use("/api/v1/admin/announcements", json({ limit: "128kb" }));
  app.use("/api/v1/admin/plots", json({ limit: "8mb" }));
  app.use("/api/v1/admin/documents", json({ limit: "8mb" }));
  app.use("/api/v1/admin/co-ownership", json({ limit: "128kb" }));
  app.use(json({ limit: "16kb" }));
  app.use(urlencoded({ extended: false, limit: "16kb" }));
  setupApp(app);
  await app.listen(config.PORT, "0.0.0.0");
}
bootstrap().catch((error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "EADDRINUSE") {
    console.error(
      `Port ${config.PORT} is already in use. Stop the existing backend process or change PORT in backend/.env.`,
    );
  } else if (code === "EACCES") {
    console.error(
      `Cannot listen on port ${config.PORT}. Check permissions or choose another PORT.`,
    );
  } else {
    console.error(
      "Backend startup failed. Check the preceding error and backend/.env configuration.",
    );
  }
  process.exitCode = 1;
});
