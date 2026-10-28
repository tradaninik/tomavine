// -------------------------------------------------------------
// Mission S6-C: stock freshness on the storefront.
//
// Three buyer-facing states for every listed product:
//   "fresh" - stock > 0 and the nursery re-confirmed it within
//             the category's window -> "Recently confirmed".
//   "stale" - stock > 0 but the confirmation is older than the
//             window (or was never given) -> "Confirmation
//             required".
//   "out"   - stock <= 0 (or null) -> "Currently unavailable";
//             the detail page adds the availableFrom date when
//             the nursery set one ("next batch around the 15th").
//
// The window resolves through the category tree exactly like
// GST (lib/category-gst.ts): the node's Category.stockFreshDays,
// else its parent top's, else the 14-day default. Admin can edit
// the per-category number (S6-C step 9); null simply inherits.
//
// PURE module on purpose (no "use client", no db import) so the
// server catalog helpers (lib/catalog.ts, the single-product
// API) and the client storefront share ONE rulebook - the state
// a tile shows can never disagree with the detail page.
// Written by s6c-create-2.ps1 as pure ASCII.
// -------------------------------------------------------------

export type StockState = "out" | "stale" | "fresh";

// Category node carrying the editable window; parent = the top.
export type FreshNode = { stockFreshDays: number | null };

// Owner-locked default when neither node nor parent sets a window.
export const DEFAULT_FRESH_DAYS = 14;

const DAY_MS = 86400000;

// Window in days from a category node chain - mirrors
// rateFromNodeChain in lib/category-gst.ts: the node's value,
// else its parent top's, else 14. Clamped to at least 1 so a
// stray 0 can never make every confirmation instantly stale.
export function freshDaysFromNodeChain(
  node: (FreshNode & { parent?: FreshNode | null }) | null | undefined,
): number {
  const days = node?.stockFreshDays ?? node?.parent?.stockFreshDays ?? DEFAULT_FRESH_DAYS;
  return Math.max(1, days);
}

// The three-state rulebook. Accepts the Prisma Date or its ISO
// string so server rows and API payloads work unchanged; `now`
// is injectable for tests. NOTE: settlement money is tracked
// separately in Order.meta.settlement and NEVER derives from
// these states (owner-locked decision: informational only).
export function stockStateOf(
  stock: number | null | undefined,
  confirmedAt: Date | string | null | undefined,
  freshDays: number,
  now: Date = new Date(),
): StockState {
  const qty = typeof stock === "number" ? stock : 0;
  if (qty <= 0) {
    return "out";
  }
  let ts = Number.NaN;
  if (confirmedAt instanceof Date) {
    ts = confirmedAt.getTime();
  } else if (typeof confirmedAt === "string") {
    ts = Date.parse(confirmedAt);
  }
  if (Number.isNaN(ts)) {
    return "stale";
  }
  return now.getTime() - ts <= freshDays * DAY_MS ? "fresh" : "stale";
}