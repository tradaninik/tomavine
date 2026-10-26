// scripts/s2-tier-check.mjs — Mission S2 bulk-tier math check.
//
//   node scripts/s2-tier-check.mjs
//   (Node 23.6+ / 24+: type stripping is on by default. On Node
//    22.6-23.5 run: node --experimental-strip-types scripts/s2-tier-check.mjs)
//
// Verifies the SINGLE source of tier truth — src/lib/bulk-tiers.ts —
// against hand-computed cases, so the storefront display
// (lib/cart.ts computeTotals) and the server charge (api/orders)
// can never disagree: both call the same helpers checked here.
// Exit 0 = all cases pass; any mismatch exits 1 with the case name.

import { BULK_TIERS, MAX_QTY, bulkTierFor, bulkDiscountFor, nextBulkTier } from "../src/lib/bulk-tiers.ts";

let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failed += 1;
}

// ── Config shape ─────────────────────────────────────────────
console.log(`Config: tiers = ${JSON.stringify(BULK_TIERS)}, MAX_QTY = ${MAX_QTY}`);
check("config: default ladder is 10+ -> 5%, 25+ -> 10%", BULK_TIERS, [{ minQty: 10, pct: 5 }, { minQty: 25, pct: 10 }]);
check("config: checkout qty cap raised to 500", MAX_QTY, 500);

// ── Tier resolution ──────────────────────────────────────────
check("qty 1  -> no tier", bulkTierFor(1), null);
check("qty 9  -> no tier (just below first)", bulkTierFor(9), null);
check("qty 10 -> 5% (first threshold)", bulkTierFor(10), { minQty: 10, pct: 5 });
check("qty 24 -> still 5%", bulkTierFor(24), { minQty: 10, pct: 5 });
check("qty 25 -> 10% (top tier wins, no stacking)", bulkTierFor(25), { minQty: 25, pct: 10 });
check("qty 500 -> 10% at the cap", bulkTierFor(500), { minQty: 25, pct: 10 });

// ── Discount math (whole rupees, Math.round) ────────────────
check("discount qty 9  unit 349 -> 0", bulkDiscountFor(349, 9), 0);
check("discount qty 10 unit 349 -> round(3490*0.05)=175 (174.5 rounds up)", bulkDiscountFor(349, 10), 175);
check("discount qty 25 unit 349 -> round(8725*0.10)=873 (872.5 rounds up)", bulkDiscountFor(349, 25), 873);
check("discount qty 25 unit 99  -> round(2475*0.10)=248 (247.5 rounds up)", bulkDiscountFor(99, 25), 248);
check("discount qty 100 unit 149 -> 1490", bulkDiscountFor(149, 100), 1490);
check("discount qty 0/edge unit 0 -> 0", bulkDiscountFor(0, 25), 0);

// ── Order math mirror: subtotal, discount, GST(5%) post-discount ──
// Case: 25 x unit 349 sapling (HSN 0601, GST 5%):
//   subtotal = 8725, discount = 873,
//   GST = round((8725 - 873) * 0.05) = round(392.6) = 393,
//   delivery = 0 (subtotal >= 499), COD = 0 (online),
//   total = 8725 - 873 + 0 + 393 + 0 = 8245.
{
  const unit = 349, qty = 25;
  const sub = unit * qty;
  const discount = bulkDiscountFor(unit, qty);
  const tax = Math.round((sub - discount) * (5 / 100));
  const deliveryFee = sub >= 499 ? 0 : 49;
  const total = sub - discount + deliveryFee + tax;
  check("order math: subtotal raw", sub, 8725);
  check("order math: Order.discount stored", discount, 873);
  check("order math: GST on post-discount value", tax, 393);
  check("order math: grand total", total, 8245);
}

// ── Next-tier hints (cart line + product page nudges) ───────
check("hint qty 1  -> Buy 10+ save 5%", nextBulkTier(1), { minQty: 10, pct: 5 });
check("hint qty 10 -> next is 25+/10%", nextBulkTier(10), { minQty: 25, pct: 10 });
check("hint qty 25 -> no further tier", nextBulkTier(25), null);
check("hint qty 30 -> no further tier", nextBulkTier(30), null);

console.log("");
if (failed === 0) {
  console.log("All tier math checks passed.");
} else {
  console.log(`${failed} check(s) FAILED.`);
}
process.exit(failed === 0 ? 0 : 1);
