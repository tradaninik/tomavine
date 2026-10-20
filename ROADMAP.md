# TOMAVINE ROADMAP (v3 — persona-driven, Oct 2026)
North star: India's plant + agri marketplace serving apartments, villas, farmers
and input sellers across Telangana & Andhra. Trust = verified nurseries + expert
growing data. Retention = plants that survive and thrive.

## CURRENTLY DEPLOYED & LIVE (as of Oct 2026, tomavine.vercel.app)
- Catalog: 5 categories (plants/saplings/inputs/pots/tools), product + nursery
  pages, search, category browsing, 60-term taxonomy (5 kinds), rescue corner
  (discounted expiring listings), reviews with star ratings, product images via
  emoji placeholders (photos pending)
- Cart + checkout: multi-nursery cart with per-nursery order split, delivery vs
  pickup modes, free delivery over Rs.499, COD (Rs.25 fee) + Razorpay online
  payments (popup flow, server-verified signatures, webhook dedupe), idempotent
  order placement
- Orders: 7-status lifecycle, customer order pages + cancel (stock restore +
  payment settle + dual notifications), seller fulfillment flow (confirm/
  prepare/dispatch/deliver), delivery OTP, promised-date trust pack, admin view
- Sellers: product CRUD with variants + SKUs, rescue listings, stock management,
  WhatsApp new-order alerts, physical nursery verification badge
- Auth: phone OTP via WhatsApp, owner password login, JWT sessions, rate limiting
- Advisory v1: plant-by-month/soil/city matcher with reason chips (city-level)
- Platform: 6 languages (en/hi/te/kn/ta/mr), WhatsApp notification spine,
  Vercel CI with gate script (route audit + 11 live probes)

## PERSONAS (build everything for one of these six)
1. APARTMENT PLANT LOVER (urban, low space): needs low-light/compact/pet-safe
   tags, watering reminders, gifting, plant-box subscription. Trust = reviews
   + healthy-arrival.
2. VILLA / TERRACE GARDENER (urban, has space): needs terrace kits, grow bags,
   drip irrigation, composting setup, layout planner. Highest urban AOV.
3. FARMER (village, Telangana/Andhra): needs village-level advisory, sapling
   spec sheets, bulk/RFQ pricing, desi vs hybrid seed clarity, organic trust.
   WhatsApp-first, voice-friendly.
4. TOWN / MIXED (semi-urban): small yard kitchen gardens; wants bundles,
   simple language, price sensitivity. Bridge persona between urban + farm.
5. INPUT SELLER (soil, vermicompost, pots, tools): heavy/bulky items need
   weight-aware delivery economics, local pickup emphasis, repeat monthly orders.
6. NURSERY OWNER (seller): needs payout visibility, demand signals, bulk
   listing tools, promotions. Everything above must be sellable by them.

## YEAR 1 — Foundation (build in this order)

1. LOCATION BACKBONE (unblocks advisor v2 + serviceability + RFQ)
   - Static JSON: TG + AP -> districts -> mandals -> villages + pincodes
     (India Post public data); district -> soil/rainfall lookup (NBSS&LUP/Bhuvan)
   - Cascading selectors; pin auto-fills land type, always editable, remembered
   - Nursery serviceable districts/pincodes (replaces single city field)

2. ADVISOR v2 — THREE MODES, ONE ENGINE
   - Indoor mode: light + space + pet-safe -> apartment plants
   - Terrace mode: terrace size (sq ft) + direction/sun + city + month ->
     veg plan + grow-bag count + potting-mix estimate + kit recommendation
   - Farm mode: district + soil + acreage + month -> sapling/seed plan with
     spec-sheet-backed matches (organic toggle, hybrid/desi/OP preference)
   - Full Telugu translation first (te), then hi (farmers + local users)

3. URBAN GREEN TRACK (apartments + villas)
   - Terrace Garden Starter Kits, Balcony Green Kits, Herb Kits, Kitchen
     Garden Kits (bundles = higher AOV, one-click persona onboarding)
   - Product tags: pet-safe, low-light, air-purifying, compact, terrace-ready
   - Composting line: kitchen-waste composters, vermicompost bins, "turn your
     kitchen waste into soil" onboarding content
   - Drip irrigation kits sized for terraces; grow bags; raised-bed sets

4. SAPLING FARMER SPEC SHEETS (saplings + seeds product type)
   - Variety/rootstock, fruiting age, yield/acre, spacing, irrigation need,
     disease resistance, season, seedType (hybrid/desi/OP), organic cert
     (Jaivik Bharat/NPOP upload, admin-verified badge)
   - Product page shows farmer spec sheet (not indoor care chips)

5. MY GARDEN + WHATSAPP CARE REMINDERS (retention engine)
   - Register purchased plants/crops; schedule from care + agri data
   - Vercel Cron daily -> WhatsApp reminders (opt-in/DND compliant)
   - Works for houseplants AND crop care

6. RFQ / BULK FLOW (farmers)
   - Quote request (items/qty/district/window) -> nursery responds with price
     + validity -> accept -> order; quantity price tiers on variants

7. CATALOG PHOTO ENRICHMENT
   - Botanical-name search on Pexels/Unsplash (free, commercial) -> Product.image
   - Manual curation for commercial varieties (accuracy > convenience)

## YEAR 1-2 — Growth, Delivery Economics & Marketing

8. WEIGHT-AWARE DELIVERY (input sellers)
   - Weight/volume class on products; delivery fee tiers by class + distance
     band (a 25kg soil bag cannot ride a flat Rs.49 fee)
   - Pickup emphasized for heavy inputs; local-radius nursery visibility
9. SUBSCRIPTIONS: monthly plant box (apartments), seasonal seed boxes,
   monthly compost/soil delivery (urban + town)
10. GIFTING: gift a plant with note + card; gift cards (Diwali/festival spikes)
11. MARKETING INTEGRATION: Google Merchant free listings (feed route),
    WhatsApp share + OG previews, species/district SEO pages (ISR), UTM in
    Order.meta, WhatsApp Business catalog
12. SERVICEABILITY + SLOTS: pincode check at cart ("delivers to your village"),
    delivery slot selection, photo reviews (verified purchase)
13. PAYOUT DASHBOARD for nurseries: settlements, commission statements, T+days
14. WISHLIST + ALERTS: price/rescue alerts via WhatsApp

## YEAR 2-3 — Intelligence & Scale
- AI Plant Doctor: sick-leaf photo -> diagnosis -> one-tap remedy add-to-cart
- Voice search (Telugu/Hindi) for low-literacy users
- Crop Planner: acres + soil + month -> full season plan (advisor + RFQ merged)
- Logistics aggregator (Shiprocket/Porter) + live-plant packaging standards
- Seller analytics (sales/views/conversion/dead stock) + promotions toolkit
- GST invoices for B2B; credit terms for repeat farmers; PWA + push

## YEAR 4-5 — Platform & Ecosystem
- B2B portal (landscapers, hotels, corporates; maintenance contracts)
- Gardener-on-demand services (repotting, pruning, orchard care)
- Demand forecasting for nurseries; Green Points loyalty; referrals
- Nursery working-capital financing partners; POS integration; more languages

## DELIBERATELY NOT DOING
- Survival guarantee (owner decision) · native apps before PWA · own fleet or
  cold chain (aggregators first) · BNPL