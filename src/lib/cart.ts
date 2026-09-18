"use client";

// ─────────────────────────────────────────────────────────────
// Tomavine customer cart (storefront).
// Pricing here mirrors src/app/api/orders/route.ts EXACTLY:
//   - unit = selected variant price, else priceMin
//   - active rescue listing -> Math.round(unit * (1 - pct / 100))
//   - GST 18% for pots/soil/seeds/tools/saplings, 5% otherwise
//   - delivery per nursery group: ₹0 on PICKUP, ₹0 at ₹499+, else ₹49
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
  category: string;
  priceMin: number;
  stock: number;
  nurseryId: string;
  nurseryName: string;
  nurserySlug: string;
  nurseryCity: string;
  variants: CartVariant[];
  rescue: { pct: number; expiresAt: string } | null;
};

export type CartGroupLine = {
  product: CartProduct;
  variant: CartVariant | null;
  variantId: string | null;
  qty: number;
  unit: number;
  lineSub: number;
  lineTax: number;
};

export type CartGroup = {
  nurseryId: string;
  nurseryName: string;
  nurserySlug: string;
  nurseryCity: string;
  lines: CartGroupLine[];
  sub: number;
  tax: number;
  deliveryFee: number;
  codFee: number;
  total: number;
};

export type CartTotals = {
  groups: CartGroup[];
  orderCount: number;
  sub: number;
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
export const MAX_QTY = 50;
export const SUPPLY_CATEGORIES = ["pots", "soil", "seeds", "tools", "saplings"];
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

export function taxRateFor(category: string): number {
  return SUPPLY_CATEGORIES.includes(category) ? 0.18 : 0.05;
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

export function computeTotals(lines: CartLine[], products: CartProduct[], mode: "DELIVERY" | "PICKUP"): CartTotals {
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
    const lineTax = Math.round(lineSub * taxRateFor(product.category));
    let group = groups.get(product.nurseryId);
    if (!group) {
      group = {
        nurseryId: product.nurseryId,
        nurseryName: product.nurseryName,
        nurserySlug: product.nurserySlug,
        nurseryCity: product.nurseryCity,
        lines: [],
        sub: 0,
        tax: 0,
        deliveryFee: 0,
        codFee: 0,
        total: 0,
      };
      groups.set(product.nurseryId, group);
    }
    group.lines.push({ product: product, variant: variant, variantId: line.variantId, qty: line.qty, unit: unit, lineSub: lineSub, lineTax: lineTax });
    group.sub += lineSub;
    group.tax += lineTax;
  }

  let sub = 0;
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
    group.codFee = COD_FEE;
    group.total = group.sub + group.deliveryFee + group.tax + group.codFee;
    sub += group.sub;
    tax += group.tax;
    delivery += group.deliveryFee;
    cod += group.codFee;
  }

  const list = Array.from(groups.values());
  return {
    groups: list,
    orderCount: list.length,
    sub: sub,
    tax: tax,
    delivery: delivery,
    cod: cod,
    total: sub + tax + delivery + cod,
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