# TOMAVINE ROADMAP (v4 - bulk-first reality, Oct 2026)

North star: India's plant + agri marketplace serving apartments, villas,
farmers and input sellers across Telangana & Andhra. Trust = verified
nurseries + expert growing data. Retention = plants that survive and thrive.

CHANGE SINCE v3: the platform pivoted bulk-first / B2B (S6-A/S6-B).
Retail is parked (legacy categories hidden, MOQ enforced end-to-end,
B2B homepage). v4 re-sequences the remaining v3 work around that
reality: money loop -> delivery economics -> retention -> growth.
No destinations were dropped; only the order changed.

## STATE OF THE PLATFORM (surveyed Oct 2026, post S6-D)

- Scale: 43 pages, 54 API routes, 25 Prisma models, 17 migrations,
  6 languages (en/hi/te/kn/ta/mr), PWA + Android Capacitor shell,
  live on tomavine.vercel.app (Vercel, auto-deploy from GitHub main)
- B2B loop COMPLETE end-to-end: RFQ -> leads -> quotes -> quote-accept
  -> order (MOQ enforced) -> Razorpay/COD -> receipts -> public tracking
  -> delivery OTP -> reviews. Admin console, seller suite, WhatsApp OTP
  + alerts, audit logs, 90-district location backbone + geo nursery data,
  advisor v2 with pincode/district/state location search (S6-D)
- Sellers: product CRUD + variants + SKUs, rescue listings, stock
  freshness (S6-B), service areas, bulk quote builder (S4)
- Platform: JWT + rate limiting, idempotent order placement, webhook
  dedupe, 6-language i18n spine, Vercel CI gate (route audit + probes)

## PERSONAS (unchanged; active vs parked noted)

1. APARTMENT PLANT LOVER ......... PARKED with retail (returns with B2C)
2. VILLA / TERRACE GARDENER ....... PARKED with retail (highest urban AOV)
3. FARMER (TG/AP, WhatsApp-first) . ACTIVE - bulk/MOQ flow serves them today
4. TOWN / MIXED ................... ACTIVE - bridge persona, bulk-capable
5. INPUT SELLER ................... ACTIVE - heavy/bulky, needs delivery
  economics + pickup emphasis (flat fees break on 25kg bags)
6. NURSERY OWNER .................. ACTIVE - needs payout visibility (S7),
  demand signals, bulk listing tools, promotions

## WHAT SHIPPED (mapped from git + survey)

- Location backbone (v3 #1) ........ DONE: 90 districts, ServiceLocation
  + NurseryServiceArea + geo, advisor location search, deliver-to chips
- RFQ / bulk flow (v3 #6) .......... DONE: S2 tiers, S3 bulk pricing +
  RFQ, S4 quote builder, S6-A quote-accept -> order, S6-B MOQ rails
- Photo enrichment (v3 #7) ......... MOSTLY DONE: AI photos, Nursery.image
- Advisory v2 (v3 #2) .............. HALF DONE: month/soil/location engine
  + location search (S6-D). Three modes (indoor/terrace/farm) NOT built
- My Garden journal (v3 #5) ........ SCHEMA ONLY: PlantJournal model
  exists, zero pages
- Spec sheets (v3 #4) .............. DATA PARTIAL: Product.agri/botanical/
  provenance exist, no farmer spec-sheet view
- Subscriptions (v3 #9) ............ SCHEMA ONLY: ServiceListing +
  Subscription models, zero pages
- Marketing (v3 #11) .............. PARTIAL: OG cards + share done; no
  sitemap, no Merchant feed, no UTM
- Payouts (v3 #13), GST invoices, weight delivery, slots, wishlist,
  gifting, coupons: NOT BUILT

## THE SEQUENCE (S7 onward)

### S7 - CLOSE THE MONEY LOOP  [next; effort M-L]
Scope: per-nursery settlement ledger (order -> commission -> net
payable -> mark-settled with UPI/bank ref), admin settlements console,
seller Payments tab, buyer-facing GST invoice print view, monthly
seller statement (CSV export). No new payment provider - this is
bookkeeping + documents on top of the existing Payment/Order rails.
Why first: sellers are paid off-platform with no records; every B2B
order deepens the hole. Persona 6 payout visibility is explicit in v3.
Serves: nursery owner (payouts), farmer/company buyers (GST invoices
for input credit).

### S8 - DELIVERY ECONOMICS  [effort M]
Scope (v3 #8 + #12): weight/volume class on products, delivery fee
tiers by class + distance band, pickup emphasized for heavy inputs,
pincode serviceability check at cart, delivery-slot scheduling against
BulkLead.neededBy (transport coordination without phone calls).
Why second: flat fees break on bulky inputs; B2B transport is currently
manual. Serves: input seller, farmer (farm-gate delivery).

### S9 - FARMER DATA + RETENTION  [effort M]
Scope (v3 #4 + #5): farmer spec sheets on sapling/seed pages
(variety, fruiting age, yield/acre, spacing, seedType, organic cert),
My Garden / crop journal UI (order items seed a journal; PlantJournal
model already exists), WhatsApp care + crop reminders via Vercel Cron,
one-tap reorder (recurring input demand is hidden revenue).
Why third: retention needs the orders flowing first; S7/S8 make those
orders healthy. Serves: farmer (spec sheets + crop care), everyone
(journal).

### S10 - GROWTH + SEO  [effort M]
Scope (v3 #11 + #14): sitemap.ts + robots.ts, product/category JSON-LD,
Google Merchant free-listings feed route, species/district ISR pages,
UTM into Order.meta, wishlist + price/rescue WhatsApp alerts.
Serves: acquisition; all personas.

### S11 - SUBSCRIPTIONS + GIFTING  [effort M-L]
Scope (v3 #9 + #10): service subscriptions surface (models exist),
monthly plant/seed boxes, monthly compost/soil delivery, gift a plant
with note, gift cards (festival spikes).
Why last of this band: needs stable logistics (S8) and proven re-order
behavior (S9) to be credible.

### B2C RETURN (when retail un-parks)
Advisor v2 three modes (indoor/terrace/farm - v3 #2), Urban Green
Track kits + tags (v3 #3), then personas 1-2 features. The category
tree (11/45) is already seeded - the storefront switch is small.

## YEAR 2-3 - Intelligence & Scale (carried from v3, unchanged)
- AI Plant Doctor: sick-leaf photo -> diagnosis -> remedy add-to-cart
- Voice search (Telugu/Hindi); Crop Planner (advisor + RFQ merged)
- Logistics aggregator (Shiprocket/Porter) + live-plant packaging
- Seller analytics (sales/views/conversion/dead stock) + promotions
  toolkit (coupons land here); PWA push notifications
- Credit terms for repeat farmers (after S7 ledger proves behavior)

## YEAR 4-5 - Platform & Ecosystem (carried from v3, unchanged)
- B2B portal (landscapers, hotels, corporates; maintenance contracts)
- Gardener-on-demand; demand forecasting; Green Points loyalty
- Nursery working-capital financing partners; POS; more languages

## DELIBERATELY NOT DOING (carried from v3, unchanged)
- Survival guarantee (owner decision)
- Own fleet or cold chain (aggregators first)
- BNPL (credit terms are Year 2-3, post-S7, and only for repeat buyers)

## HOUSEKEEPING (not a stage; do anytime)
- Commit the untracked S6-C migration (prisma/migrations/
  20261106120000_s6c_availability) - clones/deploys miss it otherwise
- .gitignore the .s*-backup/ dirs and retired helper scripts
- Replace this v3 file with this v4 (keep v3 in git history)
