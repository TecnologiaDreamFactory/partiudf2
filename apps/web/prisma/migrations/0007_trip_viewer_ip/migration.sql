-- AlterTable
ALTER TABLE "TripViewer" ADD COLUMN "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "TripViewer_tripId_ipHash_idx" ON "TripViewer"("tripId", "ipHash");
