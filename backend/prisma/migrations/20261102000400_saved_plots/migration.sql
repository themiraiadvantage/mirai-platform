CREATE TABLE "SavedPlot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "plotId" TEXT NOT NULL REFERENCES "PropertyPlot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SavedPlot_userId_plotId_key" ON "SavedPlot"("userId", "plotId");
CREATE INDEX "SavedPlot_userId_createdAt_id_idx" ON "SavedPlot"("userId", "createdAt", "id");
