# T1B - catalog search filters + pagination (SPEC)

- Status: SPEC ONLY. This document describes the work; no source code
  ships in T1B. The implementation mission (T1C) executes against this
  spec and pins every file it touches.
- Base: main at 6d46234 (T1: homepage featured quality gate + sitemap
  + robots).
- Owner decisions locked 2026-11-09 (section 2).

## 1. Problem

/shop/search is a bare client page: it reads ?q= once, fetches
/api/catalog/products?q=<q> (hard take 100, no filters, no pagination,
no result count) and renders a plain grid. The T1 worklog recorded the
gap and the plan:

- /api/catalog/products today: ?q= does a contains-match on nameEn +
  botanical (case-insensitive), take 100, no filters beyond the
  existing category/sub/cat/nursery/rescue/ids params, no pagination,
  no result count.
- The homepage featured-nursery gate (T1) shipped with
  ratingAvg >= 4.0 AND productCount >= 3, but the planned review-count
  floor (>= 2 reviews) needs a per-nursery reviewCount that
  /api/catalog/nurseries does not expose yet.

## 2. Owner decisions (locked)

1. Deliverable: this spec is committed to the repo by the T1B mission
   script (docs-only commit, no build - a markdown file under docs/
   cannot affect the Next build).
2. Scope: full T1B - search filters + pagination + result count, PLUS
   per-nursery reviewCount in /api/catalog/nurseries, PLUS the
   homepage gate review floor.
3. Depth: decisions-level spec - contracts, UX behavior, edge cases
   and the full 6-language string inventory; no code sketches.
4. Filter state: hybrid - the full state lives in the URL querystring;
   updates are applied with a history replace (no navigation, no
   reload).
5. Price filter: preset band chips PLUS optional custom min/max
   inputs.
6. Category filter: two-level chips - one row of top categories;
   selecting one reveals a second row with its subcategories.

## 3. API: /api/catalog/products (additive changes)

### 3.1 Existing params - unchanged

| param | semantics (unchanged) |
|---|---|
| q | contains-match on nameEn + botanical, case-insensitive |
| cat | a Category-tree slug: a top matches its whole subtree (its own products + every sub's), a sub matches just that sub; unknown or inactive slug returns an empty list |
| category / sub | legacy string filters (pre-tree rows) |
| nursery | nursery slug (VERIFIED + retailOk nurseries only) |
| rescue | rescue=1 limits to rescue listings that have not expired |
| ids | comma-separated product ids (max 50), for cart/checkout lookups |

### 3.2 New params

| param | type | default | semantics |
|---|---|---|---|
| page | 1-based int | 1 | page number; a malformed value (< 1, non-integer) reads as 1 |
| size | int | 100 | page size; clamped to 1..100. The default of 100 IS the legacy take - existing callers keep their exact behavior |
| min | whole INR int | (absent) | priceMin >= min; malformed (non-integer, negative) is ignored |
| max | whole INR int | (absent) | priceMin <= max; malformed is ignored |
| stock | flag | (absent) | stock=1 means stock > 0; any other value is ignored |

- min > max is not an error: the combination simply matches nothing
  (products: [], total: 0) - the same leniency as an unknown cat slug.
- Price targets Product.priceMin - the same number the tile displays
  via inr(); mrp and variant prices are not part of filtering.

### 3.3 Response (additive fields)

    { products: ProductCard[], total, page, size, pageCount }

- total = the COUNT of all products matching the full filter
  combination (not just this page).
- pageCount = ceil(total / size) - 0 when total is 0, so the pager
  hides cleanly and there is never a divide-by-zero special case.

### 3.4 Composition and edge cases

- All params AND-compose exactly as today (q + cat + nursery + ... in
  one query).
- Unknown or inactive cat slug: products: [], total: 0 (existing
  behavior, now with correct meta).
- page beyond pageCount: HTTP 200, empty products array, correct meta;
  the UI clamps (6.5).
- No new error shape: well-formed requests always get 200 - malformed
  values are clamped or ignored, matching the route's existing lenient
  style (cf. the pincode regex in /api/catalog/nurseries).
- Order stays createdAt DESC (sort controls are a non-goal, section
  10).

### 3.5 Backward compatibility (the callers that must not notice)

| caller | call | why it is safe |
|---|---|---|
| src/app/page.tsx (homepage grid) | no params | default size 100 = legacy take; reads .products only |
| /shop/c/[slug] | ?cat= | same |
| /shop/rescue | ?rescue=1 | same |
| /shop/cart, /shop/checkout, /shop/orders/[id] | ?ids= (up to 50) | ids lookups must keep returning ALL matches in one response - default size 100 preserves that (50 < 100) |
| /shop/search | ?q= | rewritten in T1C to the new params |
| /bulk | no params | same as the homepage grid |

The response only GAINS fields; no existing caller reads them.

## 4. API: /api/catalog/nurseries - reviewCount

Each nursery object gains:

    reviewCount = the number of Review rows whose product belongs to
    this nursery AND product.hidden = false

Definition notes:

- reviews on hidden products do not count (a hidden product is not
  part of the public catalog);
- retailOk is NOT part of the definition - it is a commerce switch,
  not a content switch;
- computed per request (one grouped count query or a nested _count
  include - the implementation picks); NO schema change, no
  denormalized column, nothing to migrate.

Everything else in the response is unchanged; the field is additive.

## 5. Homepage gate floor (src/app/page.tsx)

- The qualifies() predicate becomes:

      ratingAvg >= 4.0  AND  productCount >= 3  AND  reviewCount >= 2

- reviewCount comes from the /api/catalog/nurseries response
  (section 4); the page's local nursery type gains the field.
- Backfill stays EXACTLY as shipped in T1: when fewer than 4 qualify,
  the strip backfills from the same VERIFIED rating-ordered list with
  NO gate. The floor decides who LEADS the strip, not who appears on
  it - a nursery with a thin track record can still fill a card (the
  strip keeps 4 cards whenever the catalog can fill it), it just
  cannot lead.
- Live-data note: of today's four strip cards only the leaders
  (Kaveri 4.5 / 11 products, Godavari 4.4 / 9) are affected, and only
  if their review count is under 2.

## 6. /shop/search UX (rewrite of src/app/shop/search/page.tsx)

### 6.1 URL contract - the querystring is the single source of truth

| param | values | default | notes |
|---|---|---|---|
| q | free text | "" | trimmed; whitespace-only counts as absent |
| cat | a category slug (top or sub) | (absent) | identical semantics to the API param: a top = whole subtree, a sub = that sub |
| nursery | a nursery slug | (absent) | |
| min, max | whole INR | (absent) | custom price range |
| stock | 1 | (absent) | in-stock only |
| page | 1-based | 1 | |
| size | 12 / 24 / 48 | 24 | the page always passes size explicitly (the API default of 100 is for the legacy callers) |

- Canonical order: q, cat, nursery, min, max, stock, page, size;
  default-valued params are OMITTED (clean shareable URLs).
- Example: /shop/search?q=mango&cat=fruit-plants&stock=1&size=24&page=2

### 6.2 Hybrid navigation

- Every state change rewrites the querystring with a history REPLACE
  (router.replace / history.replaceState): the URL is always
  shareable and refresh-safe, but no navigation happens and the scroll
  position does not jump.
- Debounced 400 ms: the search input and the custom min/max inputs.
- Instant: every chip, the in-stock toggle, the pager, the size
  selector.
- Any filter change resets page to 1.
- Deliberate trade-off: replace (not push) means the back button
  leaves the page instead of stepping through filter states - chosen
  to avoid history spam during debounced typing.

### 6.3 Filter panel (above the grid; mobile-first; chips wrap)

Row order: search input, Category, Nursery, Price, In-stock.

a) Search input - reuses the header's search_ph placeholder; prefilled
   from ?q=. The global header search keeps working unchanged (it
   still navigates here with ?q=).
b) Category - two-level chips, single branch:
   - row 1: "All" (reuses sub_all) + one chip per ACTIVE top
     (emoji + names from /api/catalog/categories, rendered with
     displayName() in the current language);
   - selecting a top reveals row 2 with that top's subs; a sub chip
     selects just the sub;
   - "All" (or tapping the active top again) clears cat;
   - single-select by design: it reuses the existing cat= subtree
     semantics unchanged and mirrors the /shop/c pages.
c) Nursery - single-select chips: "All" + one chip per VERIFIED
   nursery with retailOk = true (filtered client-side from
   /api/catalog/nurseries; only retail nurseries can appear in
   product listings, so only they are offered as a filter).
d) Price - band chips plus custom:
   - four preset bands against priceMin: under 99 / 100-499 /
     500-1999 / 2000 and above (whole INR). The boundaries live in
     ONE constant so they can be tuned without touching i18n (labels
     are parameterized; values are formatted with inr() at render
     time - the dictionary stays currency-free);
   - a "Custom" chip reveals two small numeric inputs (From / To,
     whole rupees);
   - band and custom are mutually exclusive: picking a band clears
     the custom inputs; typing a custom value deselects the band;
   - a URL whose min/max exactly matches a band highlights that band
     chip, so shared links restore the visual state;
   - the band itself is NEVER serialized - the URL always carries
     min/max.
e) In stock - a single toggle chip (reuses the in_stock string):
   stock=1 when active, omitted when not.

The panel reuses the /shop/c idioms wholesale: the chipCls
active/inactive chip styles and the module-level tree cache
(fetchTree() once per client session).

### 6.4 Result count, grid, pager

- SectionTitle: "Results for {q}" (results_for) when q is present,
  else "All products" (t1b_all_products); the total renders as the
  count pill (the /shop/c pattern) with t1b_results_n /
  t1b_result_one as the accessible label.
- Grid: unchanged - the existing 2/3/4-column grid + ProductTile.
- Pager (hidden when total = 0 or everything fits on one page):
  - numbered buttons with a window: first, last, current +- 1,
    ellipsis for gaps (at most ~7 buttons);
  - Previous / Next chevrons (t1b_page_prev / t1b_page_next as
    aria-labels), disabled at the edges;
  - "Page {p} of {P}" (t1b_page_of) as the visible label on small
    screens;
  - size selector: three small chips 12 / 24 / 48 (default 24),
    labeled t1b_per_page.

### 6.5 States

- Loading: the existing Loading component (every fetch).
- Error: the existing load_error + retry pattern.
- Zero results WITH filters: t1b_no_match_filters + a "Clear filters"
  button (t1b_clear_filters) that resets cat / nursery / min / max /
  stock / page but KEEPS q.
- Zero results WITHOUT filters: the existing no_results + browse.
- Out-of-range page (hand-edited URL): the client clamps to the last
  page (page 1 when total = 0) and re-fetches once.
- /api/catalog/categories unreachable: the category row hides; if the
  nurseries call also failed the nursery row hides too - the page
  still searches. A missing filter row must not break search.

### 6.6 Idiom and component reuse (no new UI primitives)

SectionTitle / Btn / Empty / ErrBox / Loading / ProductTile from
../ui; chipCls + fetchTree + displayName patterns from /shop/c; inr()
for every price display. No new shared components; the page stays
self-contained.

## 7. i18n - DICT_T1B (src/lib/i18n-t1b.ts, new file)

Pattern: exactly the s6c/s7 mission-script convention - a plain TS
module, no imports, pure ASCII with \uXXXX escapes for every
non-ASCII letter (JavaScript decodes them at runtime), spread into
the single DICT in src/lib/i18n.tsx with 6 spread lines, one per
language, after the DICT_ADVR spreads.

### 7.1 Reused keys (NO new entries for these)

search_ph, results_for, no_results, load_error, retry, browse,
sub_all ("All"), in_stock ("In stock").

### 7.2 New keys (19) - full inventory

The values below are the exact \uXXXX escape forms the dictionary
file will carry (they decode to the native scripts at runtime).

| key | en | hi | te | kn | ta | mr |
|---|---|---|---|---|---|---|
| `t1b_filters` | Filters | \u092b\u093c\u093f\u0932\u094d\u091f\u0930 | \u0c2b\u0c3f\u0c32\u0c4d\u0c1f\u0c30\u0c4d\u0c32\u0c41 | \u0cab\u0cbf\u0cb2\u0ccd\u0c9f\u0cb0\u0ccd\u200c\u0c97\u0cb3\u0cc1 | \u0bb5\u0b9f\u0bbf\u0b95\u0b9f\u0bcd\u0b9f\u0bbf\u0b95\u0bb3\u0bcd | \u092b\u093f\u0932\u094d\u091f\u0930 |
| `t1b_category` | Category | \u0936\u094d\u0930\u0947\u0923\u0940 | \u0c35\u0c3f\u0c2d\u0c3e\u0c17\u0c02 | \u0cb5\u0cb0\u0ccd\u0c97 | \u0bb5\u0b95\u0bc8 | \u0936\u094d\u0930\u0947\u0923\u0940 |
| `t1b_nursery` | Nursery | \u0928\u0930\u094d\u0938\u0930\u0940 | \u0c28\u0c30\u0c4d\u0c38\u0c30\u0c40 | \u0ca8\u0cb0\u0ccd\u0cb8\u0cb0\u0cbf | \u0ba8\u0bb0\u0bcd\u0b9a\u0bb0\u0bbf | \u0928\u0930\u094d\u0938\u0930\u0940 |
| `t1b_price` | Price | \u0915\u0940\u092e\u0924 | \u0c27\u0c30 | \u0cac\u0cc6\u0cb2\u0cc6 | \u0bb5\u0bbf\u0bb2\u0bc8 | \u0915\u093f\u0902\u092e\u0924 |
| `t1b_band_under` | Under {max} | {max} \u0938\u0947 \u0915\u092e | {max} \u0c15\u0c02\u0c1f\u0c47 \u0c24\u0c15\u0c4d\u0c15\u0c41\u0c35 | {max} \u0c95\u0ccd\u0c95\u0cbf\u0c82\u0ca4 \u0c95\u0ca1\u0cbf\u0cae\u0cc6 | {max}\u0b95\u0bcd\u0b95\u0bc1\u0b95\u0bcd \u0b95\u0bc1\u0bb1\u0bc8\u0bb5\u0bc1 | {max} \u092a\u0947\u0915\u094d\u0937\u093e \u0915\u092e\u0940 |
| `t1b_band_range` | {min}-{max} | {min}-{max} | {min}-{max} | {min}-{max} | {min}-{max} | {min}-{max} |
| `t1b_band_above` | {min} and above | {min} \u0914\u0930 \u0905\u0927\u093f\u0915 | {min} \u0c2e\u0c30\u0c3f\u0c2f\u0c41 \u0c05\u0c02\u0c24\u0c15\u0c02\u0c1f\u0c47 \u0c0e\u0c15\u0c4d\u0c15\u0c41\u0c35 | {min} \u0cae\u0ca4\u0ccd\u0ca4\u0cc1 \u0c85\u0ca6\u0c95\u0ccd\u0c95\u0cbf\u0c82\u0ca4 \u0cb9\u0cc6\u0c9a\u0ccd\u0c9a\u0cc1 | {min} \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0b85\u0ba4\u0bb1\u0bcd\u0b95\u0bc1 \u0bae\u0bc7\u0bb2\u0bcd | {min} \u0906\u0923\u093f \u091c\u093e\u0938\u094d\u0924 |
| `t1b_custom` | Custom | \u0915\u0938\u094d\u091f\u092e | \u0c15\u0c38\u0c4d\u0c1f\u0c2e\u0c4d | \u0c95\u0cb8\u0ccd\u0c9f\u0cae\u0ccd | \u0ba4\u0ba9\u0bbf\u0baa\u0bcd\u0baa\u0baf\u0ba9\u0bcd | \u0938\u093e\u0928\u0941\u0915\u0942\u0932 |
| `t1b_price_from` | From | \u0938\u0947 | \u0c28\u0c41\u0c02\u0c21\u0c3f | \u0c87\u0c82\u0ca6 | \u0b87\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bc1 | \u092a\u093e\u0938\u0942\u0928 |
| `t1b_price_to` | To | \u0924\u0915 | \u0c35\u0c30\u0c15\u0c41 | \u0cb5\u0cb0\u0cc6\u0c97\u0cc6 | \u0bb5\u0bb0\u0bc8 | \u092a\u0930\u094d\u092f\u0902\u0924 |
| `t1b_results_n` | {n} results | {n} \u092a\u0930\u093f\u0923\u093e\u092e | {n} \u0c2b\u0c32\u0c3f\u0c24\u0c3e\u0c32\u0c41 | {n} \u0cab\u0cb2\u0cbf\u0ca4\u0cbe\u0c82\u0cb6\u0c97\u0cb3\u0cc1 | {n} \u0bae\u0bc1\u0b9f\u0bbf\u0bb5\u0bc1\u0b95\u0bb3\u0bcd | {n} \u092a\u0930\u093f\u0923\u093e\u092e |
| `t1b_result_one` | 1 result | 1 \u092a\u0930\u093f\u0923\u093e\u092e | 1 \u0c2b\u0c32\u0c3f\u0c24\u0c02 | 1 \u0cab\u0cb2\u0cbf\u0ca4\u0cbe\u0c82\u0cb6 | 1 \u0bae\u0bc1\u0b9f\u0bbf\u0bb5\u0bc1 | 1 \u092a\u0930\u093f\u0923\u093e\u092e |
| `t1b_no_match_filters` | No products match these filters. | \u0907\u0928 \u092b\u093c\u093f\u0932\u094d\u091f\u0930\u094b\u0902 \u0938\u0947 \u0915\u094b\u0908 \u0909\u0924\u094d\u092a\u093e\u0926 \u092e\u0947\u0932 \u0928\u0939\u0940\u0902 \u0916\u093e\u0924\u093e\u0964 | \u0c08 \u0c2b\u0c3f\u0c32\u0c4d\u0c1f\u0c30\u0c4d\u0c32\u0c24\u0c4b \u0c0f \u0c09\u0c24\u0c4d\u0c2a\u0c24\u0c4d\u0c24\u0c3f \u0c38\u0c30\u0c3f\u0c2a\u0c4b\u0c32\u0c32\u0c47\u0c26\u0c41. | \u0c88 \u0cab\u0cbf\u0cb2\u0ccd\u0c9f\u0cb0\u0ccd\u200c\u0c97\u0cb3\u0cbf\u0c97\u0cc6 \u0caf\u0cbe\u0cb5\u0cc1\u0ca6\u0cc7 \u0c89\u0ca4\u0ccd\u0caa\u0ca8\u0ccd\u0ca8 \u0cb9\u0cca\u0c82\u0ca6\u0cc1\u0cb5\u0cc1\u0ca6\u0cbf\u0cb2\u0ccd\u0cb2. | \u0b87\u0ba8\u0bcd\u0ba4 \u0bb5\u0b9f\u0bbf\u0b95\u0b9f\u0bcd\u0b9f\u0bbf\u0b95\u0bb3\u0bc1\u0b9f\u0ba9\u0bcd \u0b8e\u0ba8\u0bcd\u0ba4\u0baa\u0bcd \u0baa\u0bca\u0bb0\u0bc1\u0bb3\u0bc1\u0bae\u0bcd \u0baa\u0bca\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bb5\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8. | \u092f\u093e \u092b\u093f\u0932\u094d\u091f\u0930\u0936\u0940 \u0915\u094b\u0923\u0924\u0947\u0939\u0940 \u0909\u0924\u094d\u092a\u093e\u0926\u0928 \u091c\u0941\u0933\u0924 \u0928\u093e\u0939\u0940. |
| `t1b_clear_filters` | Clear filters | \u092b\u093c\u093f\u0932\u094d\u091f\u0930 \u0939\u091f\u093e\u090f\u0901 | \u0c2b\u0c3f\u0c32\u0c4d\u0c1f\u0c30\u0c4d\u0c32\u0c28\u0c41 \u0c24\u0c40\u0c38\u0c3f\u0c35\u0c47\u0c2f\u0c3f | \u0cab\u0cbf\u0cb2\u0ccd\u0c9f\u0cb0\u0ccd\u200c\u0c97\u0cb3\u0ca8\u0ccd\u0ca8\u0cc1 \u0ca4\u0cc6\u0cb0\u0cb5\u0cc1\u0c97\u0cca\u0cb3\u0cbf\u0cb8\u0cbf | \u0bb5\u0b9f\u0bbf\u0b95\u0b9f\u0bcd\u0b9f\u0bbf\u0b95\u0bb3\u0bc8 \u0b85\u0bb4\u0bbf | \u092b\u093f\u0932\u094d\u091f\u0930 \u0915\u093e\u0922\u093e |
| `t1b_page_prev` | Previous | \u092a\u093f\u091b\u0932\u093e | \u0c2e\u0c41\u0c28\u0c41\u0c2a\u0c1f\u0c3f | \u0cb9\u0cbf\u0c82\u0ca6\u0cbf\u0ca8 | \u0bae\u0bc1\u0ba8\u0bcd\u0ba4\u0bc8\u0baf\u0ba4\u0bc1 | \u092e\u093e\u0917\u0940\u0932 |
| `t1b_page_next` | Next | \u0905\u0917\u0932\u093e | \u0c24\u0c30\u0c4d\u0c35\u0c3e\u0c24 | \u0cae\u0cc1\u0c82\u0ca6\u0cbf\u0ca8 | \u0b85\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0ba4\u0bc1 | \u092a\u0941\u0922\u0940\u0932 |
| `t1b_page_of` | Page {p} of {P} | \u092a\u0947\u091c {p} / {P} | \u0c2a\u0c47\u0c1c\u0c40 {p} / {P} | \u0caa\u0cc1\u0c9f {p} / {P} | \u0baa\u0b95\u0bcd\u0b95\u0bae\u0bcd {p} / {P} | \u092a\u0943\u0937\u094d\u0920 {p} / {P} |
| `t1b_per_page` | Per page | \u092a\u094d\u0930\u0924\u093f \u092a\u0947\u091c | \u0c2a\u0c47\u0c1c\u0c40\u0c15\u0c3f | \u0caa\u0ccd\u0cb0\u0ca4\u0cbf \u0caa\u0cc1\u0c9f\u0c95\u0ccd\u0c95\u0cc6 | \u0b92\u0bb0\u0bc1 \u0baa\u0b95\u0bcd\u0b95\u0ba4\u0bcd\u0ba4\u0bbf\u0bb1\u0bcd\u0b95\u0bc1 | \u092a\u094d\u0930\u0924\u093f \u092a\u0943\u0937\u094d\u0920 |
| `t1b_all_products` | All products | \u0938\u092d\u0940 \u0909\u0924\u094d\u092a\u093e\u0926 | \u0c05\u0c28\u0c4d\u0c28\u0c3f \u0c09\u0c24\u0c4d\u0c2a\u0c24\u0c4d\u0c24\u0c41\u0c32\u0c41 | \u0c8e\u0cb2\u0ccd\u0cb2\u0cbe \u0c89\u0ca4\u0ccd\u0caa\u0ca8\u0ccd\u0ca8\u0c97\u0cb3\u0cc1 | \u0b85\u0ba9\u0bc8\u0ba4\u0bcd\u0ba4\u0bc1 \u0baa\u0bca\u0bb0\u0bc1\u0b9f\u0bcd\u0b95\u0bb3\u0bcd | \u0938\u0930\u094d\u0935 \u0909\u0924\u094d\u092a\u093e\u0926\u0928\u0947 |

Note: the translations follow the vocabulary already present in the
dictionary (the same words the live pages use for shop / category /
price / nursery); a native-speaker review pass during implementation
is cheap insurance, as with the earlier mission dictionaries.

## 8. Expected file touch map (T1C pins this set)

| file | change |
|---|---|
| src/app/api/catalog/products/route.ts | edit - new params + count + meta |
| src/app/api/catalog/nurseries/route.ts | edit - reviewCount |
| src/app/page.tsx | edit - gate floor + nursery type field |
| src/app/shop/search/page.tsx | rewrite - filters + pager |
| src/lib/i18n-t1b.ts | new - DICT_T1B |
| src/lib/i18n.tsx | edit - import + 6 spread lines |

No schema change, no migration, no new environment variables, no new
dependencies.

## 9. Acceptance checklist (T1C verifies each line)

API /api/catalog/products:

- [ ] a default call (no params) returns the same first 100 products
      in the same order as before (homepage + /bulk unaffected);
- [ ] ?ids= with 50 ids still returns all 50 in one response;
- [ ] page/size paginate correctly (page 2 starts where page 1 ended);
- [ ] total counts the full match, not the page; pageCount = ceil;
- [ ] min/max filter against priceMin; stock=1 filters stock > 0;
- [ ] malformed values (page=0, page=abc, size=999, min=-5) degrade
      per 3.2 (clamp or ignore), never a 500;
- [ ] unknown cat slug: products [], total 0.

API /api/catalog/nurseries:

- [ ] every nursery object carries reviewCount >= 0;
- [ ] reviewCount matches a manual count over the nursery's
      non-hidden products' reviews.

Homepage:

- [ ] a nursery with ratingAvg 4.5, 12 products and 1 review does NOT
      lead the strip (it may still appear via backfill);
- [ ] one with 4.5 / 12 / 3 reviews leads;
- [ ] backfill behavior unchanged from T1.

Search page:

- [ ] every state from 6.1 is reachable, shareable, and restores on
      reload (including a band-highlighting min/max URL);
- [ ] a filter change resets page to 1; q and the custom price inputs
      debounce; chips act instantly;
- [ ] the URL is replaced (no history entries); defaults are omitted;
- [ ] zero-with-filters shows the clear-filters action, and clearing
      keeps q;
- [ ] the pager window and the size selector behave per 6.4;
- [ ] every new string renders in all 6 languages (switch languages
      on the page and re-check).

General:

- [ ] next build passes; only the 6 files in section 8 change;
- [ ] live deploy: /shop/search works end to end on production.

## 10. Non-goals (explicit)

- Sort controls (relevance / price / rating / newest) - deferred.
- Facet counts (per-chip result counts).
- Multi-select categories or nurseries.
- Any robots.txt / sitemap change (search stays listed as in the T1
  sitemap).
- Stock-freshness inside the in-stock filter (in-stock = stock > 0
  only; freshness stays a tile badge).
- Server components / SSR of the search page (it stays a client
  page).

## 11. Rollout and rollback

- One implementation mission (T1C), one commit on main; Vercel
  auto-deploys 2-5 min after the push.
- Rollback = git revert of the T1C commit (push the revert); every
  API change is additive, so a revert is clean.
- This document (T1B) needs no rollback beyond reverting its own
  docs-only commit.
