-- Mission S6-C: availability & settlement.
--   Product.stockConfirmedAt  -> last time the seller one-tap confirmed
--                                the listed stock count (freshness clock)
--   Product.availableFrom     -> "next batch ready ~date" for out-of-stock
--                                listings (drives the WhatsApp notify-me)
--   Category.stockFreshDays   -> per-category freshness window in days;
--                                NULL = platform default (14, see
--                                src/lib/stock-fresh.ts). Resolution:
--                                sub-category value, else its top, else
--                                the default - mirrors the GST chain.
-- All columns additive + nullable: pre-S6-C rows keep working, no
-- backfill needed (NULL stockConfirmedAt simply reads "confirmation
-- required", which is the honest state for legacy listings).
ALTER TABLE "Product" ADD COLUMN "stockConfirmedAt" TIMESTAMP(3);

ALTER TABLE "Product" ADD COLUMN "availableFrom" TIMESTAMP(3);

ALTER TABLE "Category" ADD COLUMN "stockFreshDays" INTEGER;