"use client";

import { LEGACY_SUPPLY_CATEGORIES, legacyTaxRateFor, resolveRate } from "@/lib/category-gst";
import { MAX_QTY as BULK_MAX_QTY, bulkDiscountFor, type BulkTier } from "@/lib/bulk-tiers";

// ─────────────────────────────────────────────────────────────
// Tomavine customer cart (storefront).
// Pricing here mirrors src/app/api/orders/route.ts EXACTLY:
//   - unit = selected variant price, else priceMin
//   - active rescue listing -> Math.round(unit * (1 - pct / 100))
//   - bulk tier discount (mission S2): per-line quantity tiers from
//     lib/bulk-tiers.ts (10+ = 5%, 25+ = 10%), discount on the line
//     subtotal, GST on the POST-discount value, whole-rupee rounding
//   - GST resolves from the Category tree (lib/category-gst.ts):
//     the server puts the resolved whole percent on ProductCard.gstRate
//     (node rate, else parent top's, 5 floor when mapped — the same
//     rule Mission F charges in api/orders); unmapped products keep
//     the LEGACY string rule (18% pots/soil/seeds/tools, 5% otherwise
//     — plants & saplings are live plants, HSN 0601 -> 5%). The
//     legacy rule stays the fallback so display can never disagree
//     with the charge.
//   - delivery per nursery group: ₹0 on PICKUP, ₹0 at ₹499+ (raw
//     subtotal, before the bulk discount), else ₹49
//   - ₹25 COD fee per order (per nursery group)
// Rule: only call loadCart()/saveCart() inside useEffect or event
// handlers — never during render (SSR has no localStorage).
// ─────────────────────────────────────────────────────────────

export type CartLine = {
  productId: string;
  variantId: string | null;
  qty: number;
};

export type CartVariant = {
  id: string;
  label: string;
  price: number;
};

export type CartProduct = {
  id: string;
  nameEn: string;
  names?: Record<string, string> | null; // NEW: regional names (supplied by the catalog API; optional)
  image?: string | null; // product photo (supplied by the catalog lookup; optional)
  care?: Record<string, string> | null; // care info, e.g. { sun, water, soil } (supplied by the catalog lookup; optional)
  category: string;
  priceMin: number;
  stock: number;
  nurseryId: string;
  nurseryName: string;
  nurserySlug: string;
  nurseryCity: string;
  variants: CartVariant[];
  rescue: { pct: number; expiresAt: string } | null;
  // GST whole percent resolved server-side from the Category tree
  // (null = unmapped → legacy string fallback). See lib/category-gst.ts.
  gstRate?: number | null;
};

export type CartGroupLine = {
  product: CartProduct;
  variant: CartVariant | null;
  variantId: string | null;
  qty: number;
  unit: number;
  lineSub: number;
  lineDiscount: number;
  lineTax: number;
};

export type CartGroup = {
  nurseryId: string;
  nurseryName: string;
  nurserySlug: string;
  nurseryCity: string;
  lines: CartGroupLine[];
  sub: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  codFee: number;
  total: number;
};

export type CartTotals = {
  groups: CartGroup[];
  orderCount: number;
  sub: number;
  discount: number;
  tax: number;
  delivery: number;
  cod: number;
  total: number;
};

export type AddResult = {
  ok: boolean;
  reason: string | null;
  lines: CartLine[];
};

export const CART_KEY = "tomavine_cart_v1";
export const CART_EVENT = "tomavine:cart";
export const MAX_LINES = 20;
// Mission S2: raised from 50 to 500 so bulk tier orders (10+ / 25+)
// can be placed online. Single source of truth is lib/bulk-tiers.ts.
export const MAX_QTY = BULK_MAX_QTY;
// Supply goods attract 18% GST; everything else (plants, saplings,
// inputs) is 5%. Saplings are live plants, HSN 0601 -> 5%.
// Retained for backwards compatibility; the canonical copy lives in
// lib/category-gst.ts (LEGACY_SUPPLY_CATEGORIES) — keep them in sync.
export const SUPPLY_CATEGORIES = LEGACY_SUPPLY_CATEGORIES;
export const FREE_DELIVERY_AT = 499;
export const DELIVERY_FEE = 49;
export const COD_FEE = 25;

export function loadCart(): CartLine[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const clean: CartLine[] = [];
    for (const x of parsed) {
      if (!x || typeof x !== "object") {
        continue;
      }
      const productId = typeof x.productId === "string" ? x.productId : null;
      const variantId = typeof x.variantId === "string" ? x.variantId : null;
      const qty = typeof x.qty === "number" && Number.isInteger(x.qty) ? x.qty : 0;
      if (!productId || qty < 1) {
        continue;
      }
      clean.push({ productId: productId, variantId: variantId, qty: Math.min(qty, MAX_QTY) });
    }
    return clean;
  } catch {
    return [];
  }
}

export function saveCart(lines: CartLine[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(productId: string, variantId: string | null, qty: number): AddResult {
  const lines = loadCart();
  const existing = lines.find((l) => l.productId === productId && l.variantId === variantId);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, MAX_QTY);
    saveCart(lines);
    return { ok: true, reason: null, lines: lines };
  }
  if (lines.length >= MAX_LINES) {
    return { ok: false, reason: "Cart is full (20 lines max). Remove something first.", lines: lines };
  }
  const clamped = Math.min(Math.max(1, Math.round(qty)), MAX_QTY);
  const next = [...lines, { productId: productId, variantId: variantId, qty: clamped }];
  saveCart(next);
  return { ok: true, reason: null, lines: next };
}

export function setQty(productId: string, variantId: string | null, qty: number): CartLine[] {
  let lines = loadCart();
  if (qty <= 0) {
    lines = lines.filter((l) => !(l.productId === productId && l.variantId === variantId));
    saveCart(lines);
    return lines;
  }
  lines = lines.map((l) =>
    l.productId === productId && l.variantId === variantId
      ? { productId: l.productId, variantId: l.variantId, qty: Math.min(qty, MAX_QTY) }
      : l,
  );
  saveCart(lines);
  return lines;
}

export function removeLine(productId: string, variantId: string | null): CartLine[] {
  const lines = loadCart().filter((l) => !(l.productId === productId && l.variantId === variantId));
  saveCart(lines);
  return lines;
}

export function clearCart(): void {
  saveCart([]);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

export function rescueActive(product: CartProduct): boolean {
  if (!product.rescue) {
    return false;
  }
  return new Date(product.rescue.expiresAt).getTime() > Date.now();
}

// LEGACY string rule (for callers that only have the category
// string). Cart/checkout tax now goes through resolveRate() so a
// Category-tree rate wins when the product carries one.
export function taxRateFor(category: string): number {
  return legacyTaxRateFor(category);
}

export function variantOf(product: CartProduct, variantId: string | null): CartVariant | null {
  return product.variants.find((v) => v.id === variantId) ?? product.variants[0] ?? null;
}

export function unitPriceOf(product: CartProduct, variantId: string | null): number {
  const variant = variantOf(product, variantId);
  let unit = variant ? variant.price : product.priceMin;
  const r = product.rescue;
  if (r && new Date(r.expiresAt).getTime() > Date.now()) {
    unit = Math.round(unit * (1 - r.pct / 100));
  }
  return unit;
}

// ── Display pricing (S8 Wave C) ───────────────────────────────
// The single source for what the UI shows, so display can never
// disagree with the charge. `now` is the effective price — the
// same math as unitPriceOf (variant price else priceMin, active
// rescue applied, expiry-aware). `before` is the pre-discount
// reference for struck-through display: striking the price the
// discount was actually taken on makes the struck->bold gap
// match the badge percent exactly. A lapsed rescue shows full
// price everywhere.

export function rescueLive(rescue: { pct: number; expiresAt: string } | null | undefined): boolean {
  if (!rescue) {
    return false;
  }
  return new Date(rescue.expiresAt).getTime() > Date.now();
}

export type DisplayPrice = { now: number; before: number };

export function displayPriceOf(
  p: { priceMin: number; variants: { id: string; price: number }[]; rescue: { pct: number; expiresAt: string } | null },
  variantId: string | null,
): DisplayPrice {
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0] ?? null;
  const before = variant ? variant.price : p.priceMin;
  const r = p.rescue;
  if (r && rescueLive(r)) {
    return { now: Math.round(before * (1 - r.pct / 100)), before: before };
  }
  return { now: before, before: before };
}

export function computeTotals(lines: CartLine[], products: CartProduct[], mode: "DELIVERY" | "PICKUP", payMethod: "cod" | "online" = "cod", opts?: { tiers?: readonly BulkTier[] }): CartTotals {
  const byId = new Map<string, CartProduct>();
  for (const p of products) {
    byId.set(p.id, p);
  }

  const groups = new Map<string, CartGroup>();
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      continue;
    }
    const variant = variantOf(product, line.variantId);
    const unit = unitPriceOf(product, line.variantId);
    const lineSub = unit * line.qty;
    // Mission S2 (scope A1): auto tier discount per line — same math
    // as api/orders (Math.round(lineSub * pct/100)); GST then applies
    // on the post-discount value so display == charge.
    const lineDiscount = bulkDiscountFor(unit, line.qty, opts?.tiers);
    const lineTax = Math.round((lineSub - lineDiscount) * resolveRate(product));
    let group = groups.get(product.nurseryId);
    if (!group) {
      group = {
        nurseryId: product.nurseryId,
        nurseryName: product.nurseryName,
        nurserySlug: product.nurserySlug,
        nurseryCity: product.nurseryCity,
        lines: [],
        sub: 0,
        discount: 0,
        tax: 0,
        deliveryFee: 0,
        codFee: 0,
        total: 0,
      };
      groups.set(product.nurseryId, group);
    }
    group.lines.push({ product: product, variant: variant, variantId: line.variantId, qty: line.qty, unit: unit, lineSub: lineSub, lineDiscount: lineDiscount, lineTax: lineTax });
    group.sub += lineSub;
    group.discount += lineDiscount;
    group.tax += lineTax;
  }

  let sub = 0;
  let discount = 0;
  let tax = 0;
  let delivery = 0;
  let cod = 0;
  for (const group of groups.values()) {
    if (mode === "PICKUP") {
      group.deliveryFee = 0;
    } else if (group.sub >= FREE_DELIVERY_AT) {
      group.deliveryFee = 0;
    } else {
      group.deliveryFee = DELIVERY_FEE;
    }
    group.codFee = payMethod === "cod" ? COD_FEE : 0;
    group.total = group.sub - group.discount + group.deliveryFee + group.tax + group.codFee;
    sub += group.sub;
    discount += group.discount;
    tax += group.tax;
    delivery += group.deliveryFee;
    cod += group.codFee;
  }

  const list = Array.from(groups.values());
  return {
    groups: list,
    orderCount: list.length,
    sub: sub,
    discount: discount,
    tax: tax,
    delivery: delivery,
    cod: cod,
    total: sub - discount + tax + delivery + cod,
  };
}

export function missingLines(lines: CartLine[], products: CartProduct[]): CartLine[] {
  const ids = new Set(products.map((p) => p.id));
  return lines.filter((l) => !ids.has(l.productId));
}

export function overStockLines(lines: CartLine[], products: CartProduct[]): CartLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.filter((l) => {
    const p = byId.get(l.productId);
    return p ? l.qty > p.stock : false;
  });
}