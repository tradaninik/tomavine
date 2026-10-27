-- S4: quotation builder, buyer quote pages, lead pipeline.
-- Additive + idempotent only: safe to re-run with identical results.
-- Legacy single-amount quotes keep working: items stay null, total
-- stays 0 and every reader falls back to amount.

ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "items" JSONB;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "transport" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "total" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "token" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3);

-- Public link token (unguessable; NULL on legacy rows = no public page).
CREATE UNIQUE INDEX IF NOT EXISTS "Quote_token_key" ON "Quote" ("token");