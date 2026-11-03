import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config";
import { Request, Response, NextFunction } from "express";

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix("api/v1");
  app.use(helmet({ referrerPolicy: { policy: "no-referrer" } }));
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const allowed = [new URL(config.FRONTEND_URL).origin, new URL(config.API_URL).origin];
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.origin &&
      !allowed.includes(request.headers.origin)
    ) {
      response.status(403).json({ statusCode: 403, message: "Untrusted request origin" });
      return;
    }
    next();
  });
  app.use(
    (
      _request: unknown,
      response: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      response.setHeader("Cache-Control", "no-store");
      next();
    },
  );
  app.enableCors({
    origin: new URL(config.FRONTEND_URL).origin,
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.enableShutdownHooks();
}
