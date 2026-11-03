BEGIN;
-- AlterTable
ALTER TABLE "BuyerNotification" ADD COLUMN     "body" TEXT,
ADD COLUMN     "href" TEXT,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "announcementId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PropertyPlot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "lga" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "price" DECIMAL(16,2) NOT NULL,
    "legalFee" DECIMAL(16,2) NOT NULL,
    "surveyFee" DECIMAL(16,2) NOT NULL,
    "documentationFee" DECIMAL(16,2) NOT NULL,
    "reservationFee" DECIMAL(16,2) NOT NULL,
    "accessMonths" INTEGER NOT NULL,
    "publication" TEXT NOT NULL DEFAULT 'Draft',
    "availability" TEXT NOT NULL DEFAULT 'Available',
    "verification" TEXT NOT NULL DEFAULT 'unchecked',
    "coEnabled" BOOLEAN NOT NULL DEFAULT false,
    "coMonths" INTEGER NOT NULL DEFAULT 3,
    "coDepositPercent" INTEGER NOT NULL DEFAULT 10,
    "version" INTEGER NOT NULL DEFAULT 1,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyPlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlotAsset" (
    "id" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlotAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoPolicy" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "offer" JSONB NOT NULL,
    "preference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "matchId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoMatch" (
    "id" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "agreement" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoContribution" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoAllocation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portion" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyPlot_code_key" ON "PropertyPlot"("code");

-- CreateIndex
CREATE INDEX "PropertyPlot_publication_createdAt_id_idx" ON "PropertyPlot"("publication", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PlotAsset_plotId_idx" ON "PlotAsset"("plotId");

-- CreateIndex
CREATE UNIQUE INDEX "CoPolicy_version_key" ON "CoPolicy"("version");

-- CreateIndex
CREATE INDEX "CoRequest_userId_createdAt_id_idx" ON "CoRequest"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CoRequest_plotId_status_idx" ON "CoRequest"("plotId", "status");

-- CreateIndex
CREATE INDEX "CoRequest_matchId_idx" ON "CoRequest"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "CoContribution_reference_key" ON "CoContribution"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CoAllocation_matchId_userId_key" ON "CoAllocation"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "PlotAsset" ADD CONSTRAINT "PlotAsset_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "PropertyPlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoRequest" ADD CONSTRAINT "CoRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoRequest" ADD CONSTRAINT "CoRequest_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "PropertyPlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoRequest" ADD CONSTRAINT "CoRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CoPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoRequest" ADD CONSTRAINT "CoRequest_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "CoMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoMatch" ADD CONSTRAINT "CoMatch_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "PropertyPlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoContribution" ADD CONSTRAINT "CoContribution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CoRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoAllocation" ADD CONSTRAINT "CoAllocation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "CoMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants also hold for writes outside the HTTP service.
ALTER TABLE "ActivityEvent" DROP CONSTRAINT "ActivityEvent_category_check";
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_category_check" CHECK ("category" IN ('AUTH','STAFF','SETTINGS','ANNOUNCEMENTS','PLOTS','CO_OWNERSHIP'));
ALTER TABLE "PropertyPlot" ADD CONSTRAINT "PropertyPlot_values_check" CHECK ("size" >= 0 AND "price" >= 0 AND "legalFee" >= 0 AND "surveyFee" >= 0 AND "documentationFee" >= 0 AND "reservationFee" >= 0 AND "accessMonths" BETWEEN 1 AND 120 AND "coMonths" BETWEEN 1 AND 120 AND "coDepositPercent" BETWEEN 0 AND 100 AND "version" > 0);
ALTER TABLE "PropertyPlot" ADD CONSTRAINT "PropertyPlot_status_check" CHECK ("publication" IN ('Draft','Published','Archived') AND "availability" IN ('Available','Reserved','Sold') AND "verification" IN ('unchecked','pending','in_progress','verified'));
ALTER TABLE "PropertyPlot" ADD CONSTRAINT "PropertyPlot_coeligibility_check" CHECK (NOT "coEnabled" OR ("size" >= 500 AND "verification" = 'verified'));
ALTER TABLE "CoRequest" ADD CONSTRAINT "CoRequest_status_check" CHECK ("status" IN ('WAITING','PROPOSED','ACTIVE','ALLOCATED','CANCELLED'));
ALTER TABLE "CoMatch" ADD CONSTRAINT "CoMatch_status_check" CHECK ("status" IN ('PROPOSED','ACTIVE','ALLOCATED','CANCELLED'));
ALTER TABLE "CoContribution" ADD CONSTRAINT "CoContribution_amount_check" CHECK ("amount" > 0);
ALTER TABLE "PlotAsset" ADD CONSTRAINT "PlotAsset_kind_check" CHECK ("kind" IN ('PHOTO','LISTING_DOCUMENT','PRIVATE_DOCUMENT'));
ALTER TABLE "CoAllocation" ADD CONSTRAINT "CoAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoAllocation" ADD CONSTRAINT "CoAllocation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlotAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CoRequest_one_active_buyer_plot" ON "CoRequest"("userId", "plotId") WHERE "status" <> 'CANCELLED';
CREATE UNIQUE INDEX "CoMatch_one_committed_plot" ON "CoMatch"("plotId") WHERE "status" <> 'CANCELLED';
ALTER TABLE "BuyerNotification" ADD CONSTRAINT "BuyerNotification_content_check" CHECK ("announcementId" IS NOT NULL OR ("title" IS NOT NULL AND "body" IS NOT NULL));

COMMIT;
