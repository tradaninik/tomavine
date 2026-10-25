// ─────────────────────────────────────────────────────────────
// Category-tree GST resolution (Mission 2c — client-display flip).
//
// Mission F already moved the SERVER charge onto the tree
// (gstPercent() in src/app/api/orders/route.ts: node rate, else
// parent top's, else 5 when a node exists; legacy string rule only
// for unmapped products). 2c's remaining job is the CLIENT: the
// cart/checkout display must resolve the same rate so what the
// buyer sees can never disagree with what they are charged.
//
// Server catalog APIs (lib/catalog.ts productCard) resolve the
// final whole percent onto ProductCard.gstRate — a NUMBER for
// every tree-mapped product (5 floor, mirroring F's server rule),
// null only for unmapped products. The client then falls back to
// the legacy string rule — identical to the pre-2c behavior for
// those rows.
//
// This module is deliberately PURE (no "use client", no db import)
// so both the server include helpers and client cart code share it.
//
// LEGAL REVIEW FLAGS (no rate changes made in code — see seed):
//   - seeds top seeded at 5% (legacy effective rate — seed products
//     sat under inputs@5%; the old "seeds" entry in the supply list
//     never fired because Product.category was never "seeds").
//   - plant-protection / decor / irrigation / gifts seeded at 18%
//     (HSN 3808 pesticides and clay articles may be lower in law).
// ─────────────────────────────────────────────────────────────

// The legacy string rule, exactly as it lived in src/lib/cart.ts
// (SUPPLY_CATEGORIES) and src/app/api/orders/route.ts (SUPPLY)
// before the tree. Kept as the fallback for unmapped products.
export const LEGACY_SUPPLY_CATEGORIES = ["pots", "soil", "seeds", "tools"];

export function legacyTaxRateFor(category: string): number {
  return LEGACY_SUPPLY_CATEGORIES.includes(category) ? 0.18 : 0.05;
}

export type GstNode = { gstRate: number | null };

// Whole percent from a node chain — MIRRORS Mission F's gstPercent
// in api/orders: the node's rate, else its parent top's, else 5
// when the product is tree-mapped at all. Returns null ONLY when
// there is no node (unmapped product → caller uses the legacy
// string rule). The 5 floor keeps F's server charge and the 2c
// client display byte-identical for every mapped product.
export function rateFromNodeChain(
  node: (GstNode & { parent?: GstNode | null }) | null | undefined,
): number | null {
  if (!node) {
    return null;
  }
  return node.gstRate ?? node.parent?.gstRate ?? 5;
}

// Client entry: a ProductCard/CartProduct payload carrying the
// server-resolved whole percent in `gstRate` (null/absent =
// unmapped → legacy string fallback). Returns the rate FRACTION
// used by the existing computations (same shape as the old
// taxRateFor).
export function resolveRate(product: { category: string; gstRate?: number | null }): number {
  if (typeof product.gstRate === "number") {
    return product.gstRate / 100;
  }
  return legacyTaxRateFor(product.category);
}
