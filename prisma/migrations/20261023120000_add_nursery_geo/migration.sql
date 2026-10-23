-- Add nursery geo binding (Location Backbone v1).
-- Purely additive: three nullable columns + one index. No data is
-- touched. The one-shot scripts/backfill-nursery-geo.mjs fills the
-- values by matching each nursery's existing city name.

-- AlterTable
ALTER TABLE "Nursery" ADD COLUMN     "districtCode" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Nursery_districtCode_idx" ON "Nursery"("districtCode");
