# Tomavine - Smoke Test Checklist

Run after every build, every push, and at session end.

Rules of engagement: paste output, don't guess. Any FAIL anywhere -> stop and paste it before touching anything.

## The rhythm (every change)

File -> Save All (Ctrl+K, S) -> verify with greps (case-sensitive counts) -> stop dev (Ctrl+C) -> npm run build (green, "5 migrations found") -> npm run dev (Terminal 1, never closed mid-session) -> Terminal 2: node scripts/gate.mjs -> GATE GREEN (paste the verdict block) -> commit by explicit path (directories for [id] parents) -> git status read in full -> push -> Vercel Ready -> node scripts/gate.mjs https://tomavine.vercel.app -> paste the block.

The gate chains the route audit + smoke probes and prints one verdict block - that block is the canonical record. With no URL it auto-detects the dev server (probes localhost:3000/3001/3002 and verifies Tomavine's landing HTML - a busy port is not proof). An unexplained delta in pages/refs is an alarm; an explained one (new route, new link) is fine.

## Tier 1 - every build (~4 min, no login)

- [ ] npm run build - green, prints "5 migrations found in prisma/migrations". (The route count moves as routes are added; the route table is the truth.)
- [ ] node scripts/gate.mjs - GATE GREEN. Current baseline: 26 pages / 34 API routes / 128 refs / 0 broken; data 60 terms / 5 kinds, 11 products, 3 nurseries.
- [ ] Browser: landing renders (fonts, hero, tiles) -> one product page -> switch the language pill once -> /login shows the phone form.

Production, after Vercel shows Ready:

node scripts/gate.mjs https://tomavine.vercel.app

## Tier 2 - role menu (run only the rows the batch touched)

| Row | Log in as | Check | Pass looks like |
|---|---|---|---|
| Storefront | nobody | category tile -> product page -> search -> rescue -> nurseries + a pincode (e.g. 560088) -> nursery page | everything renders; pincode verdicts appear |
| Care + photos | nobody | cart with a plant + a sapling; a category page after uploads | care chips on cart lines; photos on tiles with emoji fallback; pots/tools show no care chips |
| Customer (read) | Meera +919704699511 | /shop/orders; add to cart -> cart -> remove; open a DELIVERED order | list loads; care card on plant orders; add/remove works |
| Customer [DB WRITE] | Meera | checkout -> COD order -> order detail -> cancel | NH-... code appears; cancel sticks |
| Seller (read) | Ravi +919030984021 | /seller overview, cockpit, products, settings | all load; hidden products visible in the seller list |
| Seller [DB WRITE] | Ravi | edit a plant: subcategory + care -> save; upload a photo | pills update; chips + care appear buyer-side; photo shows on tiles/cart |
| Super admin (read) | founder +916281456004 | all six admin tabs, users console, audit feed | users list + audit entries render |
| Super admin [DB WRITE] | founder | onboard ZZ Test Nursery (phone 9000000001) -> queue -> users -> audit -> then reject + demote | full trail visible, then cleaned up |
| Scoped admin | an ADMIN with explicit scopes (create via /admin/users) | tabs hidden per scopes; open an out-of-scope /api/admin/* URL directly | page shells only; API returns 403 |

[DB WRITE] = writes to the database. The Neon DB is SHARED between localhost and
production - anything created while testing exists on production too.

Test-data conventions: names prefixed ZZ, phones 90000xxxxxx. There are no deletes
(by design) - cleanup = reject (nurseries), demote (users), deactivate (taxonomy).
Max ONE test order per session; leaving it DELIVERED with a review is fine.

Photo uploads need BLOB_READ_WRITE_TOKEN in .env (local) AND in Vercel env vars
(production). Without it the upload fails with a clean "not configured" error - that
is the designed behaviour, not a bug. After the first upload batch, glance at
Vercel -> Storage usage.

## Tier 3 - session end

Local full journey (replaces the [DB WRITE] rows above - don't run both):
fresh browse -> add 2 items -> cart -> checkout (COD) -> as Ravi: accept -> out for
delivery -> delivered -> as Meera: order detail shows the delivery PIN + care card,
leave the review -> as founder: /admin/orders shows it, /admin/audit shows the trail.

Production (after Ready): landing loads -> node scripts/gate.mjs https://tomavine.vercel.app
-> founder login (OTP from Vercel -> Deployments -> Logs) -> read-only glance at this
session's new surfaces. Never run [DB WRITE] rows on production unless it's real data.

## Test accounts

| Role | Phone | Notes |
|---|---|---|
| SUPER_ADMIN (founder) | +916281456004 | you |
| SELLER | +919030984021 | Ravi - Green Leaf Nurseries (verified) |
| CUSTOMER | +919704699511 | Meera |

OTP: dev = the [WA:skipped] line in Terminal 1; production = Vercel -> Deployments -> Logs.

## Standing rules

- Neon sleeps: P1001 or a hung probe -> wait 15 seconds, re-run once.
- After a .next clear, first page loads are slow (compiling) - not a failure.
- Dev server lives in Terminal 1 and is never closed mid-session; probes run in Terminal 2.
- Save All before every build; after multi-file saves, verify with git --no-pager grep
  (case-sensitive) before building.
- localhost, tomavine.vercel.app, and per-deployment URLs each keep their own login cookie.
- git grep is case-sensitive (setFoo is not found by "foo"); derive counts case-sensitively.

## Baseline (update when counts move)

Pages 26 | API routes 34 | Refs 128 | 5 migrations - as of S9 batch 3 (care guidance,
subcategory edit, seller photo upload). The invariants: "No broken internal links found.",
0 broken, and every delta explained before pushing.