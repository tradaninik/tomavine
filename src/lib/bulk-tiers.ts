// ─────────────────────────────────────────────────────────────
// Bulk-buying tier discounts (mission S2, scope A1).
//
// THE owner-editable config: per line-item quantity tiers that
// auto-apply at cart/checkout. Raise the checkout quantity cap
// here too. Both the storefront display math (src/lib/cart.ts
// computeTotals) and the server charge (src/app/api/orders) read
// the SAME constants from this module, so what the buyer sees can
// never disagree with what the order stores.
//
// Rules (mirrored in cart.ts + api/orders):
//   - tiers apply PER CART LINE (product+variant), on the line's
//     effective subtotal (variant price, active rescue already in)
//   - the HIGHEST tier whose minQty <= line qty wins (no stacking)
//   - discount = Math.round(lineSub * pct / 100)  → whole rupees
//   - GST is computed on the POST-discount value
//   - Order.discount stores the per-nursery sum (existing field)
//   - free-delivery threshold still compares the RAW subtotal
// ─────────────────────────────────────────────────────────────

// Sorted ascending by minQty; the last matching tier wins.
// Edit the numbers here when the owner asks — nothing else to touch.
export const BULK_TIERS: { minQty: number; pct: number }[] = [
  { minQty: 10, pct: 5 },
  { minQty: 25, pct: 10 },
];

// Checkout quantity cap per line item (was 50 before mission S2;
// raised so bulk tier orders can actually be placed online).
export const MAX_QTY = 500;

export type BulkTier = { minQty: number; pct: number };

// The tier a given quantity earns (null when below every tier).
export function bulkTierFor(qty: number): BulkTier | null {
  let earned: BulkTier | null = null;
  for (const tier of BULK_TIERS) {
    if (qty >= tier.minQty) {
      earned = tier;
    }
  }
  return earned;
}

// Whole-rupee line discount for (unit, qty) — the exact amount
// both computeTotals and api/orders store/charge.
export function bulkDiscountFor(unitPrice: number, qty: number): number {
  const tier = bulkTierFor(qty);
  if (!tier) {
    return 0;
  }
  return Math.round(unitPrice * qty * (tier.pct / 100));
}

// The next tier the quantity has NOT reached yet — powers the
// "Buy 10+, save 5%" nudge on cart lines and product pages.
export function nextBulkTier(qty: number): BulkTier | null {
  for (const tier of BULK_TIERS) {
    if (qty < tier.minQty) {
      return tier;
    }
  }
  return null;
}
