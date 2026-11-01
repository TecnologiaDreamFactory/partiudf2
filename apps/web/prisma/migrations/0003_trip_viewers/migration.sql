-- CreateTable
CREATE TABLE "TripViewer" (
    "tripId" TEXT NOT NULL,
    "visitorId" UUID NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripViewer_pkey" PRIMARY KEY ("tripId","visitorId")
);

-- CreateIndex
CREATE INDEX "TripViewer_visitorId_idx" ON "TripViewer"("visitorId");

-- AddForeignKey
ALTER TABLE "TripViewer" ADD CONSTRAINT "TripViewer_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase: igual as outras tabelas (0002), a Data API nao le nada com a chave publica.
ALTER TABLE "TripViewer" ENABLE ROW LEVEL SECURITY;
