CREATE TABLE "WorkspaceSettings" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "company" TEXT NOT NULL DEFAULT 'MIRAI',
  "email" TEXT NOT NULL DEFAULT 'futurewithmirai@gmail.com',
  "phone" TEXT NOT NULL DEFAULT '',
  "reservationFee" INTEGER NOT NULL DEFAULT 30000,
  "accessMonths" INTEGER NOT NULL DEFAULT 12,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceSettings_singleton" CHECK ("id" = 'platform'),
  CONSTRAINT "WorkspaceSettings_fee_range" CHECK ("reservationFee" >= 0),
  CONSTRAINT "WorkspaceSettings_access_range" CHECK ("accessMonths" BETWEEN 1 AND 120)
);
INSERT INTO "WorkspaceSettings" ("id") VALUES ('platform');
