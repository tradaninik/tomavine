import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";
import { notifySellerNewOrder } from "@/lib/notify";
import { nurseryFeatureOn } from "@/lib/nursery-features";
import { bulkDiscountFor } from "@/lib/bulk-tiers";
import { getSettings } from "@/lib/settings";
import { DELIVERY_STATE_OPTIONS } from "@/lib/states";

// Supply goods attract 18% GST; everything else (plants, saplings,
// inputs) is 5%. Saplings are live plants, HSN 0601 -> 5%.
const SUPPLY = ["pots", "soil", "seeds", "tools"];

// Mission F: tree-mapped products carry their GST on the category
// node (sub inherits from its top when null). Unmapped products keep
// the legacy string heuristic. Rates are whole percents.
function gstPercent(prod: {
  category: string;
  categoryNode: { gstRate: number | null; parent: { gstRate: number | null } | null } | null;
}): number {
  if (prod.categoryNode) {
    return prod.categoryNode.gstRate ?? prod.categoryNode.parent?.gstRate ?? 5;
  }
  return SUPPLY.includes(prod.category) ? 18 : 5;
}
const Addr = z.object({ name: z.string().min(2), phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  house: z.string().min(1), street: z.string().optional(), city: z.string().min(2),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  // Mission S2 (scope C): state rides on the address JSON (column
  // is Json — no schema change), validated server-side. Informational
  // only: no state is blocked, no automatic transport fee is added.
  state: z.enum([...DELIVERY_STATE_OPTIONS] as [string, ...string[]]) });
const Body = z.object({
  items: z.array(z.object({ productId: z.string(), variantId: z.string().nullish(), qty: z.number().int().min(1) })).min(1).max(20),
  mode: z.enum(["DELIVERY", "PICKUP"]), address: Addr,
  paymentMethod: z.enum(["upi", "card", "nb", "wallet", "cod"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const idem = req.headers.get("idempotency-key") ?? crypto.randomUUID();
  const dup = await db.payment.findFirst({ where: { idempotencyKey: { startsWith: idem } } });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { items, mode, address, paymentMethod } = p.data;

  // Mission S3: admin-configurable per-line cap (default 500) and live
  // tier config. The server is authoritative; client math is display-only.
  const settings = await getSettings();
  if (items.some((it) => it.qty > settings.maxQty)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const ids = [...new Set(items.map(i => i.productId))];
  const products = await db.product.findMany({
    where: { id: { in: ids }, hidden: false },
    include: { variants: true, rescue: true, nursery: true, categoryNode: { include: { parent: true } } },
  });
  if (products.length !== ids.length) return NextResponse.json({ error: "unavailable" }, { status: 400 });

  const groups = new Map<string, any>();
  for (const it of items) {
    const prod = products.find(x => x.id === it.productId)!;
    if (prod.nursery.status !== "VERIFIED" || !prod.nursery.retailOk)
      return NextResponse.json({ error: "nursery_unavailable" }, { status: 400 });
    const v = prod.variants.find(v => v.id === it.variantId) ?? prod.variants[0] ?? null;
    let unit = v ? v.price : prod.priceMin;
    if (prod.rescue && prod.rescue.expiresAt > new Date()) unit = Math.round(unit * (1 - prod.rescue.pct / 100));
    const lineSub = unit * it.qty;
    // Mission S2 (scope A1): auto bulk-tier discount per line —
    // Math.round(lineSub * pct/100) via lib/bulk-tiers.ts (10+ = 5%,
    // 25+ = 10%). GST applies on the POST-discount value; the sum
    // lands in Order.discount. Mirrors lib/cart.ts computeTotals
    // EXACTLY so display == charge.
    const lineDiscount = bulkDiscountFor(unit, it.qty, settings.tiers);
    const g = groups.get(prod.nurseryId) ?? { items: [], sub: 0, discount: 0, tax: 0, nursery: prod.nursery };
    g.items.push({ productId: prod.id, variantId: v?.id ?? null, qty: it.qty, unitPrice: unit,
      nameSnap: (prod.names as any)?.en ?? prod.nameEn, vlabel: v?.label ?? null });
    g.sub += lineSub;
    g.discount += lineDiscount;
    g.tax += Math.round((lineSub - lineDiscount) * (gstPercent(prod) / 100));
    groups.set(prod.nurseryId, g);
  }

  // Mission F: franchise payment switches — EVERY nursery in the cart
  // must accept the chosen method, or the whole cart refuses (one
  // order per nursery, one payment for all of them).
  for (const g of groups.values()) {
    if (paymentMethod === "cod" && !nurseryFeatureOn(g.nursery.features, "cod")) {
      return NextResponse.json({ error: "cod_unavailable", nursery: g.nursery.name }, { status: 400 });
    }
    if (paymentMethod !== "cod" && !nurseryFeatureOn(g.nursery.features, "online")) {
      return NextResponse.json({ error: "online_unavailable", nursery: g.nursery.name }, { status: 400 });
    }
  }

  // One transaction for EVERY group: either the whole cart becomes
  // orders or nothing does. (Previously each group committed
  // separately — a mid-cart stock failure left earlier groups sold.)
  let orders;
  try {
    orders = await db.$transaction(async (tx) => {
      for (const g of groups.values()) {
        for (const item of g.items) {  // atomic stock decrement — oversell throws
          const r = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.qty } }, data: { stock: { decrement: item.qty } } });
          if (r.count === 0) throw new Error(`STOCK:${item.nameSnap}`);
        }
      }
      const year = new Date().getFullYear();
      const seq = 1810 + (await tx.order.count());
      const created: any[] = [];
      let i = 0;
      for (const [nurseryId, g] of groups) {
        const deliveryFee = mode === "PICKUP" ? 0 : g.sub >= 499 ? 0 : 49;
        // Mission S2: total is post-discount; Order.discount carries
        // the tier savings, subtotal stays the raw line sum (matches
        // the storefront math in lib/cart.ts computeTotals).
        const total = g.sub - g.discount + deliveryFee + g.tax + (paymentMethod === "cod" ? 25 : 0);
        const order = await tx.order.create({ data: {
          code: `NH-${year}-${seq + i++}`,
          userId: session.payload.sub!, nurseryId, status: "PENDING", mode,
          subtotal: g.sub, discount: g.discount, deliveryFee, tax: g.tax, total, address,
          items: { create: g.items },
          events: { create: { status: "PENDING", actorRole: "CUSTOMER", note: paymentMethod === "cod" ? "COD" : "Online" } },
        } });
        // Payment row inside the tx: the idempotency record commits
        // atomically with the order, so a crash between order-create
        // and payment-create can never duplicate on retry.
        await tx.payment.create({ data: { orderId: order.id, method: paymentMethod, amount: total, status: "CREATED", idempotencyKey: `${idem}:${nurseryId}` } });
        created.push(order);
      }
      return created;
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Concurrent double-submit on the same key — the other request
      // won; report a duplicate, not an error.
      const again = await db.payment.findFirst({ where: { idempotencyKey: { startsWith: idem } } });
      if (again) return NextResponse.json({ ok: true, duplicate: true });
    }
    const msg = String(e?.message ?? "");
    if (msg.startsWith("STOCK:")) {
      return NextResponse.json({ error: "out_of_stock", item: msg.replace("STOCK:", "") }, { status: 409 });
    }
    console.error("checkout failed", e);
    return NextResponse.json({ error: "order_failed" }, { status: 500 });
  }

  const results = [];
  for (const order of orders) {
    if (paymentMethod !== "cod" && process.env.RAZORPAY_KEY_ID) {
      let rzpId: string | null = null;
      try {
        const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST",
          headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_SECRET}`).toString("base64")}` },
          body: JSON.stringify({ amount: order.total * 100, currency: "INR", receipt: order.code }) });
        const rzp = await r.json();
        if (rzp && typeof rzp.id === "string") rzpId = rzp.id;
      } catch { rzpId = null; }
      if (rzpId) {
        await db.payment.update({ where: { orderId: order.id }, data: { rzpOrderId: rzpId } });
        results.push({ code: order.code, amount: order.total, rzpOrderId: rzpId });
      } else {
        // Order stands; payment init failed (bad keys / network / Razorpay
        // down). Flag it so checkout can tell the buyer instead of
        // silently handing the page an undefined rzpOrderId.
        await db.payment.update({ where: { orderId: order.id }, data: { status: "FAILED" } });
        results.push({ code: order.code, amount: order.total, payInitFailed: true });
      }
    } else {
      results.push({ code: order.code, amount: order.total });
    }
  }

  for (const order of orders) {
    try {
      await notifySellerNewOrder(order.id);
    } catch (e) {
      // A notification failure must never fail a committed checkout.
      console.error("notifySellerNewOrder failed for " + order.code, e);
    }
  }

  return NextResponse.json({ ok: true, orders: results, keyId: process.env.RAZORPAY_KEY_ID ?? null });
}