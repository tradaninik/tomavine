-- Franchise controls (mission F): per-nursery feature switches and the
-- nursery <-> service-location link table.

-- Per-nursery module/payment switches. null = every module enabled.
ALTER TABLE "Nursery" ADD COLUMN "features" JSONB;

-- Which nursery serves which serviceable pincode.
CREATE TABLE "NurseryServiceArea" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NurseryServiceArea_pkey" PRIMARY KEY ("id")
);

-- Nursery FK with cascade delete: rejecting/removing a nursery removes
-- its service areas with it.
ALTER TABLE "NurseryServiceArea" ADD CONSTRAINT "NurseryServiceArea_nurseryId_fkey"
  FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NurseryServiceArea" ADD CONSTRAINT "NurseryServiceArea_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One row per (nursery, location) pair; duplicates bounce with P2002.
CREATE UNIQUE INDEX "NurseryServiceArea_nurseryId_locationId_key"
  ON "NurseryServiceArea"("nurseryId", "locationId");

-- "Who serves this pincode?" scans by location.
CREATE INDEX "NurseryServiceArea_locationId_idx" ON "NurseryServiceArea"("locationId");
