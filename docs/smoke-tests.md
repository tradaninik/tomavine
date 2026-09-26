# Tomavine - Smoke Test Checklist



Run after every build, every push, and at session end.

Rules of engagement: paste output, don't guess. Any FAIL anywhere -> stop and paste it before touching anything.



## The rhythm (every change)



File -> Save All (Ctrl+K, S) -> stop dev (Ctrl+C) -> npm run build (green) ->

node scripts/audit-routes.mjs ("No broken internal links found.") ->

npm run dev (Terminal 1) -> Tier 1 -> Tier 2 rows for what the batch touched ->

commit -> push -> Vercel Ready -> production Tier 1.



## Tier 1 - every build (~4 min, no login)



- [ ] npm run build - green. (Static-page count moves as routes are added; the route table is the truth.)

- [ ] node scripts/audit-routes.mjs - ends with "No broken internal links found." (Counts move as we build; the invariant is always 0 broken.)

- [ ] npm run dev in Terminal 1. Never close Terminal 1 mid-session (corrupted .next - gotcha 28).

- [ ] Terminal 2: node scripts/smoke.mjs - all probes PASS, taxonomy prints 60 terms / 5 kinds. (If smoke.mjs is missing, probe manually: /, /login, /shop/rescue, /shop/nurseries, /api/auth/me, taxonomy, products, nurseries, one deep product + one nursery page.)

- [ ] Browser: landing renders (fonts, hero, tiles) -> one product page -> switch the language pill once -> /login shows the phone form.



Production, after Vercel shows Ready:

node scripts/smoke.mjs https://tomavine.vercel.app



## Tier 2 - role menu (run only the rows the batch touched)



| Row | Log in as | Check | Pass looks like |

|---|---|---|---|

| Storefront | nobody | category tile -> product page -> search -> rescue -> nurseries + a pincode (e.g. 560088) -> nursery page | everything renders; pincode verdicts appear |

| Customer (read) | Meera +919704699511 | /shop/orders; add to cart -> cart -> remove | list loads; add/remove works |

| Customer [DB WRITE] | Meera | checkout -> COD order -> order detail -> cancel | NH-... code appears; cancel sticks |

| Seller (read) | Ravi +919030984021 | /seller overview, cockpit, products, settings | all load; hidden lemongrass visible in the seller list |

| Seller [DB WRITE] | Ravi | accept -> out for delivery -> delivered | transitions stick; buyer PIN shows on the order detail |

| Super admin (read) | founder +916281456004 | all six admin tabs, users console, audit feed | users list + audit entries render |

| Super admin [DB WRITE] | founder | onboard ZZ Test Nursery (phone 9000000001) -> queue -> users -> audit -> then reject + demote | full trail visible, then cleaned up |

| Scoped admin | an ADMIN with explicit scopes (create via /admin/users) | tabs hidden per scopes; open an out-of-scope /api/admin/* URL directly | page shells only; API returns 403 |



[DB WRITE] = writes to the database. The Neon DB is SHARED between localhost and

production - anything created while testing exists on production too.



Test-data conventions: names prefixed ZZ, phones 90000xxxxxx. There are no deletes

(by design) - cleanup = reject (nurseries), demote (users), deactivate (taxonomy).

Max ONE test order per session; leaving it DELIVERED with a review is fine.



## Tier 3 - session end



Local full journey (replaces the [DB WRITE] rows above - don't run both):

fresh browse -> add 2 items -> cart -> checkout (COD) -> as Ravi: accept -> out for

delivery -> delivered -> as Meera: order detail shows the delivery PIN, leave the

review -> as founder: /admin/orders shows it, /admin/audit shows the trail.



Production (after Ready): landing loads -> node scripts/smoke.mjs https://tomavine.vercel.app

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

- Save All before every build; after multi-file saves, verify with findstr before building.

- localhost, tomavine.vercel.app, and per-deployment URLs each keep their own login cookie.



## Baseline (update when counts move)



Pages 25 | API routes 32 | Refs 113 - as of Batch 4b-2a (Session 5).

The invariant is always: "No broken internal links found."

