CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_BUYERS', 'SELECTED_BUYERS');
CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" "AnnouncementAudience" NOT NULL,
  "buyerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
  "authorId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "BuyerNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuyerNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BuyerNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuyerNotification_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Announcement_createdAt_id_idx" ON "Announcement"("createdAt", "id");
CREATE UNIQUE INDEX "BuyerNotification_announcementId_userId_key" ON "BuyerNotification"("announcementId", "userId");
CREATE INDEX "BuyerNotification_userId_createdAt_id_idx" ON "BuyerNotification"("userId", "createdAt", "id");
CREATE INDEX "BuyerNotification_userId_readAt_idx" ON "BuyerNotification"("userId", "readAt");
