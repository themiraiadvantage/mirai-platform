BEGIN;
ALTER TABLE "PlotAsset" ALTER COLUMN "data" DROP NOT NULL,
  ADD COLUMN "cloudinaryPublicId" TEXT,
  ADD COLUMN "cloudinaryUrl" TEXT,
  ADD COLUMN "cloudinaryFormat" TEXT,
  ADD COLUMN "cloudinaryVersion" INTEGER;
CREATE UNIQUE INDEX "PlotAsset_cloudinaryPublicId_key" ON "PlotAsset"("cloudinaryPublicId");
ALTER TABLE "PlotAsset" ADD CONSTRAINT "PlotAsset_storage_check" CHECK (
  ("data" IS NOT NULL AND "cloudinaryPublicId" IS NULL AND "cloudinaryUrl" IS NULL AND "cloudinaryFormat" IS NULL AND "cloudinaryVersion" IS NULL)
  OR ("data" IS NULL AND "kind" = 'PHOTO' AND "cloudinaryPublicId" IS NOT NULL AND "cloudinaryUrl" IS NOT NULL AND "cloudinaryFormat" IS NOT NULL AND "cloudinaryFormat" IN ('jpg','png','webp') AND "cloudinaryVersion" IS NOT NULL)
);
CREATE TABLE "CloudinaryCleanup" (
  "publicId" TEXT NOT NULL,
  "notBefore" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudinaryCleanup_pkey" PRIMARY KEY ("publicId")
);
CREATE INDEX "CloudinaryCleanup_notBefore_idx" ON "CloudinaryCleanup"("notBefore");
COMMIT;
