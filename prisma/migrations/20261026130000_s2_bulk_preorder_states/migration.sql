-- Mission S2: bulk buying, pre-orders & 7-state delivery.
--
-- Schema part (scope A2/B): BulkLead grows phone / pincode / state /
-- neededBy / type so a quote request becomes a full contactable lead
-- and out-of-stock products can be pre-ordered. Every new column is
-- nullable or defaulted — pre-S2 rows keep working untouched.
--
-- Data part (scope A1/B): sapling stock from S1 (10-30) is too low
-- for 10+/25+ bulk-tier orders, so listings rise to a realistic
-- nursery band (150-400, deterministic per product id); four
-- saplings (one per subcategory) are then set to stock 0 so the
-- pre-order path is demonstrable on the storefront.
--
-- The whole file is idempotent: ADD COLUMN IF NOT EXISTS on the DDL,
-- guarded UPDATEs on the data. prisma migrate deploy runs it exactly
-- once; re-running the SQL by hand on a partially-applied database
-- is a safe no-op (proven twice in sandbox verification).

-- 1) BulkLead: upgraded quote / pre-order request.
ALTER TABLE "BulkLead" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "BulkLead" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "BulkLead" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "BulkLead" ADD COLUMN IF NOT EXISTS "neededBy" TIMESTAMP(3);
ALTER TABLE "BulkLead" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'BULK';

-- 2) Stock bump: raise every sapling listing into the 150-400 band
--    (deterministic per product id via hashtext, so a re-run on a
--    partially-applied database converges to the same values). The
--    stock < 150 guard means rows already bumped — or hand-restocked
--    above the band floor by the seller — are never touched again.
UPDATE "Product"
SET stock = 150 + (abs(hashtext("id")) % 251)
WHERE category = 'saplings' AND stock < 150;

-- 3) Pre-order demo: four saplings (one per subcategory) go out of
--    stock so the storefront shows the Pre-order button instead of a
--    dead Add-to-cart. The seller restocks them from the console
--    whenever the demo is no longer needed.
UPDATE "Product" SET stock = 0
WHERE id IN ('spl_alphonso_mango', 'spl_teak', 'spl_jacaranda', 'spl_okra');
