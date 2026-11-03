BEGIN;
ALTER TABLE "PlotAsset"
 ADD COLUMN "category" TEXT NOT NULL DEFAULT 'General',
 ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'Awaiting review',
 ADD COLUMN "reviewerName" TEXT,
 ADD COLUMN "reviewedAt" TIMESTAMP(3),
 ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "recipientId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "fileVersion" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PlotAsset" ADD CONSTRAINT "PlotAsset_reviewStatus_check" CHECK ("reviewStatus" IN ('Awaiting review','Approved','Changes requested'));
ALTER TABLE "PlotAsset" ADD CONSTRAINT "PlotAsset_recipient_check" CHECK ("recipientId" IS NULL OR "kind" = 'PRIVATE_DOCUMENT');
CREATE INDEX "PlotAsset_recipientId_idx" ON "PlotAsset"("recipientId");
CREATE TABLE "DocumentVersion" (
 "id" TEXT PRIMARY KEY,
 "assetId" TEXT NOT NULL REFERENCES "PlotAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "number" INTEGER NOT NULL CHECK ("number" > 0),
 "name" TEXT NOT NULL,
 "mime" TEXT NOT NULL,
 "data" BYTEA NOT NULL,
 "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 5242880),
 "uploadedBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DocumentVersion_assetId_number_key" ON "DocumentVersion"("assetId","number");
INSERT INTO "DocumentVersion" ("id","assetId","number","name","mime","data","size","uploadedBy","createdAt")
 SELECT gen_random_uuid()::text,"id",1,"name","mime","data",octet_length("data"),'Existing upload',"createdAt" FROM "PlotAsset" WHERE "kind" <> 'PHOTO' AND "data" IS NOT NULL;
UPDATE "PlotAsset" SET "updatedAt" = "createdAt";
ALTER TABLE "ActivityEvent" DROP CONSTRAINT "ActivityEvent_category_check";
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_category_check" CHECK ("category" IN ('AUTH','STAFF','SETTINGS','ANNOUNCEMENTS','PLOTS','CO_OWNERSHIP','PAYMENTS','DOCUMENTS'));
COMMIT;
