import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z
    .string()
    .min(48)
    .refine((value) => !value.includes("REPLACE_")),
  API_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  MAIL_FROM: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
  PAYSTACK_SECRET_KEY: z
    .string()
    .trim()
    .regex(/^sk_test_[a-zA-Z0-9]+$/)
    .optional(),
  PAYSTACK_PUBLIC_KEY: z
    .string()
    .trim()
    .regex(/^pk_test_[a-zA-Z0-9]+$/)
    .optional(),
});

export function loadConfig() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const value = parsed.data;
  if (
    value.NODE_ENV === "production" &&
    [value.API_URL, value.FRONTEND_URL].some((url) => !url.startsWith("https://"))
  ) {
    throw new Error("Production API_URL and FRONTEND_URL must use HTTPS");
  }
  return value;
}
export const config = loadConfig();
