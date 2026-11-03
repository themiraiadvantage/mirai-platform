BEGIN;
CREATE TABLE "PlotReservation" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "plotId" TEXT NOT NULL REFERENCES "PropertyPlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amountKobo" BIGINT NOT NULL CHECK ("amountKobo" > 0),
  "accessMonths" INTEGER NOT NULL CHECK ("accessMonths" > 0),
  "termsVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "checkoutExpiresAt" TIMESTAMP(3) NOT NULL,
  "accessExpiresAt" TIMESTAMP(3),
  "reviewReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlotReservation_status_check" CHECK ("status" IN ('PENDING','ACTIVE','EXPIRED','FAILED','REVIEW_REQUIRED'))
);
CREATE UNIQUE INDEX "PlotReservation_one_open_plot" ON "PlotReservation"("plotId") WHERE "status" IN ('PENDING','ACTIVE');
CREATE INDEX "PlotReservation_userId_createdAt_id_idx" ON "PlotReservation"("userId","createdAt","id");
CREATE INDEX "PlotReservation_status_checkoutExpiresAt_idx" ON "PlotReservation"("status","checkoutExpiresAt");
CREATE TABLE "ReservationPayment" (
  "id" TEXT PRIMARY KEY,
  "reservationId" TEXT NOT NULL REFERENCES "PlotReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reference" TEXT NOT NULL,
  "amountKobo" BIGINT NOT NULL CHECK ("amountKobo" > 0),
  "currency" TEXT NOT NULL DEFAULT 'NGN' CHECK ("currency" = 'NGN'),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','SUCCESS','FAILED')),
  "mode" TEXT NOT NULL DEFAULT 'test' CHECK ("mode" = 'test'),
  "authorizationUrl" TEXT,
  "providerId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ReservationPayment_reservationId_key" ON "ReservationPayment"("reservationId");
CREATE UNIQUE INDEX "ReservationPayment_reference_key" ON "ReservationPayment"("reference");
CREATE UNIQUE INDEX "ReservationPayment_providerId_key" ON "ReservationPayment"("providerId");
CREATE INDEX "ReservationPayment_createdAt_id_idx" ON "ReservationPayment"("createdAt","id");
ALTER TABLE "ActivityEvent" DROP CONSTRAINT "ActivityEvent_category_check";
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_category_check" CHECK ("category" IN ('AUTH','STAFF','SETTINGS','ANNOUNCEMENTS','PLOTS','CO_OWNERSHIP','PAYMENTS'));
COMMIT;
