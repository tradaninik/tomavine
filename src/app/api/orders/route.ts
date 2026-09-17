import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";
import { notifySellerNewOrder } from "@/lib/notify";

const SUPPLY = ["pots", "soil", "seeds", "tools", "saplings"];
const Addr = z.object({ name: z.string().min(2), phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  house: z.string().min(1), street: z.string().optional(), city: z.string().min(2),
  pincode: z.string().regex(/^[1-9]\d{5}$/) });
const Body = z.object({
  items: z.array(z.object({ productId: z.string(), variantId: z.string().nullish(), qty: z.number().int().min(1).max(50) })).min(1).max(20),
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

  const ids = [...new Set(items.map(i => i.productId))];
  const products = await db.product.findMany({ where: { id: { in: ids }, hidden: false }, include: { variants: true, rescue: true, nursery: true } });
  if (products.length !== ids.length) return NextResponse.json({ error: "unavailable" }, { status: 400 });

  const groups = new Map<string, any>();
  for (const it of items) {
    const prod = products.find(x => x.id === it.productId)!;
    if (prod.nursery.status !== "VERIFIED" || !prod.nursery.retailOk)
      return NextResponse.json({ error: "nursery_unavailable" }, { status: 400 });
    const v = prod.variants.find(v => v.id === it.variantId) ?? prod.variants[0] ?? null;
    let unit = v ? v.price : prod.priceMin;
    if (prod.rescue && prod.rescue.expiresAt > new Date()) unit = Math.round(unit * (1 - prod.rescue.pct / 100));
    const g = groups.get(prod.nurseryId) ?? { items: [], sub: 0, tax: 0, nursery: prod.nursery };
    g.items.push({ productId: prod.id, variantId: v?.id ?? null, qty: it.qty, unitPrice: unit,
      nameSnap: (prod.names as any)?.en ?? prod.nameEn, vlabel: v?.label ?? null });
    g.sub += unit * it.qty;
    g.tax += Math.round(unit * it.qty * (SUPPLY.includes(prod.category) ? 0.18 : 0.05));
    groups.set(prod.nurseryId, g);
  }

  const results = [];
  for (const [nurseryId, g] of groups) {
    const deliveryFee = mode === "PICKUP" ? 0 : g.sub >= 499 ? 0 : 49;
    const total = g.sub + deliveryFee + g.tax + (paymentMethod === "cod" ? 25 : 0);
    let order;
    try {
      order = await db.$transaction(async (tx) => {
        for (const item of g.items) {  // atomic stock decrement — oversell throws
          const r = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.qty } }, data: { stock: { decrement: item.qty } } });
          if (r.count === 0) throw new Error(`STOCK:${item.nameSnap}`);
        }
        const seq = 1810 + (await tx.order.count());
        return await tx.order.create({ data: {
          code: `NH-${new Date().getFullYear()}-${seq}`,
          userId: session.sub!, nurseryId, status: "PENDING", mode,
          subtotal: g.sub, deliveryFee, tax: g.tax, total, address,
          items: { create: g.items },
          events: { create: { status: "PENDING", actorRole: "CUSTOMER", note: paymentMethod === "cod" ? "COD" : "Online" } },
        } });
      });
    } catch (e: any) {
      return NextResponse.json({ error: "out_of_stock", item: String(e.message).replace("STOCK:", "") }, { status: 409 });
    }
    await db.payment.create({ data: { orderId: order.id, method: paymentMethod, amount: total, status: "CREATED", idempotencyKey: `${idem}:${nurseryId}` } });

    if (paymentMethod !== "cod" && process.env.RAZORPAY_KEY_ID) {
      const rzp = await fetch("https://api.razorpay.com/v1/orders", { method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_SECRET}`).toString("base64")}` },
        body: JSON.stringify({ amount: total * 100, currency: "INR", receipt: order.code }) }).then(r => r.json());
      await db.payment.update({ where: { orderId: order.id }, data: { rzpOrderId: rzp.id } });
      results.push({ code: order.code, amount: total, rzpOrderId: rzp.id });
    } else results.push({ code: order.code, amount: total });

    await notifySellerNewOrder(order.id);
  }
  return NextResponse.json({ ok: true, orders: results, keyId: process.env.RAZORPAY_KEY_ID ?? null });
}