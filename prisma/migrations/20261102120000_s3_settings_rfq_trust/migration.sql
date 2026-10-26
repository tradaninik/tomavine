-- S3: admin-configurable bulk pricing, RFQ item lists, verified badge.
-- Additive + idempotent only: safe to re-run with identical results.

CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "Nursery" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BulkLead" ADD COLUMN IF NOT EXISTS "items" JSONB;

-- RFQ leads carry an item list instead of a single product.
ALTER TABLE "BulkLead" ALTER COLUMN "productId" DROP NOT NULL;

-- Seed defaults: EXACTLY today's live S2 pricing, so nothing changes
-- for customers on deploy. No WhatsApp number is seeded (hidden until
-- the owner sets one in the seller console).
INSERT INTO "SiteSetting" ("key", "value", "updatedAt")
VALUES (
    'bulk',
    '{"tiers": [{"minQty": 10, "pct": 5}, {"minQty": 25, "pct": 10}], "maxQty": 500, "preorderEnabled": true}'::jsonb,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

-- Verified Nursery badge (informational only).
UPDATE "Nursery" SET "verified" = true WHERE "slug" = 'green-leaf' AND NOT "verified";