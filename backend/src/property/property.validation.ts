import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const money = z.number().int().min(0).max(1_000_000_000_000);
export const plotInput = z
  .object({
    code: text(30).regex(/^[A-Z0-9-]{3,30}$/),
    title: text(160),
    description: text(10000),
    location: text(160),
    lga: text(100),
    state: text(100),
    size: z.number().int().min(0).max(10000000),
    price: money,
    legalFee: money,
    surveyFee: money,
    documentationFee: money,
    reservationFee: money,
    accessMonths: z.number().int().min(1).max(120),
    publication: z.enum(["Draft", "Published", "Archived"]),
    availability: z.enum(["Available", "Reserved", "Sold"]),
    verification: z.enum(["unchecked", "pending", "in_progress", "verified"]),
    coEnabled: z.boolean(),
    coMonths: z.number().int().min(1).max(120),
    coDepositPercent: z.number().int().min(0).max(100),
    version: z.number().int().min(1).optional(),
    details: z
      .object({
        plans: z
          .array(z.enum(["Outright", "3mo", "6mo"]))
          .min(1)
          .max(3),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        siteStatus: text(200),
        docSummary: text(1000),
        notes: text(5000),
        beacons: z
          .array(
            z
              .object({
                id: text(30).min(1),
                lat: z.number().min(-90).max(90),
                lng: z.number().min(-180).max(180),
              })
              .strict(),
          )
          .max(100)
          .default([]),
        checks: z
          .array(
            z
              .object({
                key: text(50).min(1),
                label: text(100).min(1),
                result: z.enum(["ok", "further", "nodata"]),
                source: text(1000),
                date: text(40),
                reviewer: text(160),
                notes: text(2000),
              })
              .strict(),
          )
          .max(30)
          .default([]),
      })
      .strict(),
  })
  .strict();
export const policyInput = z
  .object({ title: text(160).min(3), body: text(20000).min(30) })
  .strict();
export const requestInput = z
  .object({
    plotId: z.string().uuid(),
    policyId: z.string().uuid(),
    version: z.number().int().min(1),
    accepted: z.literal(true),
    preference: text(500),
  })
  .strict();
export const matchInput = z
  .object({
    firstRequestId: z.string().uuid(),
    secondRequestId: z.string().uuid(),
    agreement: text(20000).min(30),
    notes: text(5000),
  })
  .strict();
export const contributionInput = z
  .object({
    requestId: z.string().uuid(),
    amount: z.number().positive().max(1e12).multipleOf(0.01),
    reference: text(120).min(3),
    receivedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const allocationInput = z
  .object({
    portions: z
      .array(
        z
          .object({
            userId: z.string().uuid(),
            portion: text(2000).min(5),
            documentId: z.string().uuid(),
          })
          .strict(),
      )
      .length(2),
  })
  .strict();
export const assetInput = z
  .object({
    name: text(160).min(1),
    mime: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
    kind: z.enum(["PHOTO", "LISTING_DOCUMENT", "PRIVATE_DOCUMENT"]),
    base64: z
      .string()
      .max(7_000_000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export const matchAcceptanceInput = z.object({ matchId: z.string().uuid() }).strict();
export const pageInput = z
  .object({
    cursor: z.string().uuid().optional(),
    q: text(128).optional(),
    status: text(30).optional(),
  })
  .strict();
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return result.data;
}
