# Tomavine

Tomavine is an online marketplace connecting Indian plant nurseries with urban
gardeners. Customers browse plants, saplings, seeds, inputs, pots and tools in
six languages, order from verified local nurseries, and pay via Razorpay
(UPI / cards / netbanking) or cash on delivery. Nurseries self-serve: they
apply, get verified, and manage their own catalog, orders, leads and reviews.

Repository: https://github.com/tradaninik/tomavine

## Features

**Storefront** (`/shop`)
- Category browsing (a two-level tree — 11 top categories, 45 subcategories,
  six-language names, per-category GST rates — is seeded in the database;
  storefront browsing currently uses the five legacy top categories while the
  tree-powered pages roll out).
- Location-aware shopping: 90 districts across Telangana, Andhra Pradesh and
  Karnataka; deliver-to chip, delivery ETA bands, nearest-first nurseries.
- Product pages with botanical names and care guidance, nursery storefronts,
  search, plant advisor, Discount Center, reviews.
- Six languages: English, Hindi, Telugu, Kannada, Tamil, Marathi.
- Checkout with Razorpay online payments (webhook-verified) or COD (with COD
  fee); GST-aware cart totals.

**Accounts**
- Phone-number OTP login for Indian numbers: six-digit codes delivered over
  WhatsApp when configured (server logs otherwise), stored hashed with 10-minute
  expiry, per-phone rate limiting, JWT sessions.
- Owner and super-admin roles with a fine-grained permission model.

**Seller workspace** (`/seller`)
- Self-serve application (`/sell`) with admin verification.
- Product management with image upload (Vercel Blob), stock and pricing;
  per-nursery category allow-lists enforced at listing time.
- Orders, customer leads, reviews and nursery settings.

**Admin console** (`/admin`)
- Dashboard with stats; nursery verification and settings (retail toggle,
  category allow-lists); order, user and taxonomy-term management; audit log.

**Platform**
- WhatsApp Cloud API for OTP and order notifications, plus an inbound webhook.
- Upstash Redis rate limiting, jose JWT sessions, zod-validated API routes.

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS 4 ·
Prisma 6 + Neon Postgres · Razorpay · WhatsApp Cloud API · Upstash Redis ·
Vercel Blob

## Project layout

- `src/app/` — routes and API handlers (`shop/`, `seller/`, `admin/`, `api/`)
- `src/lib/` — i18n, catalog, cart and GST, geo/location, security, WhatsApp,
  taxonomy, advisor, permissions
- `prisma/` — schema, migrations, seed (reference only — do not run against
  production)
- `scripts/` — operational data scripts (see below)
- `public/photos/` — product and hero photography with per-image credits in
  `CREDITS.md`
- `docs/` — pitch and smoke-test documentation

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `JWT_SECRET` | yes | OTP hashing and session JWTs |
| `OWNER_PHONE`, `OWNER_PASSWORD` | yes | Owner login (admin bootstrap) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | optional | Online payments (COD works without them) |
| `WA_PHONE_NUMBER_ID`, `WA_TOKEN` | optional | WhatsApp OTP/notification delivery (falls back to server logs) |
| `WA_APP_SECRET`, `WA_VERIFY_TOKEN` | optional | WhatsApp webhook signature and subscription |
| `UPSTASH_URL`, `UPSTASH_TOKEN` | optional | Redis-backed rate limiting |
| `BLOB_READ_WRITE_TOKEN` | optional | Seller product-image uploads (Vercel Blob) |

## Local development

```bash
npm install        # also runs "prisma generate" via postinstall
npm run dev
```

Create a `.env` with at least `DATABASE_URL` and `JWT_SECRET` before starting.
After pulling changes that touch `prisma/schema.prisma`, run:

```bash
npx prisma generate
```

`npm run build` runs `prisma migrate deploy` before `next build`, so building
applies pending migrations to the database pointed at by `DATABASE_URL`.

## Operational scripts

All database scripts load credentials via `scripts/lib/db-env.mjs` (shell
environment wins; a stray non-Postgres `DATABASE_URL` is ignored with a
warning) and print the effective URL with credentials masked.

| Script | Purpose |
| --- | --- |
| `scripts/list-product-names.mjs` | Read-only product/nursery listing with category-tree paths (ground truth for data work) |
| `scripts/seed-categories.mjs` | Idempotent upsert of the 56-node category tree (re-runs overwrite tree values) |
| `scripts/backfill-product-categories.mjs` | Maps products onto the tree by exact name, with legacy-category top-level fallback |
| `scripts/add-photos.mjs` | Attaches photos to products/nurseries by exact name |
| `scripts/fix-product-data.mjs` | Targeted product data corrections |
| `scripts/backfill-nursery-geo.mjs` | District/geo backfill for nurseries |
| `scripts/make-super-admin.mjs` | Grants super-admin permissions to a phone number |
| `scripts/gate.mjs`, `scripts/smoke.mjs`, `scripts/audit-routes.mjs` | Checks and audits |

Product-name matching (photo, fix and backfill scripts) uses
`scripts/lib/product-match.mjs`: exact matches beat loose ones, ambiguity and
misses fail loudly with candidates — never a silent skip.

## Photography policy

Only license-verified imagery ships with this repository. Every image's
source, author and license is recorded in `public/photos/CREDITS.md`; new
contributions must follow the same rule.

## Deployment

The project is built for Vercel: push to `main`, set the environment variables
above in the project settings, and each deployment runs
`prisma migrate deploy && next build`.

## Documentation

- `ROADMAP.md` — product roadmap
- `docs/pitch.md`, `docs/smoke-tests.md` — pitch and test walkthroughs
- `AGENTS.md` / `CLAUDE.md` — instructions for AI coding agents
