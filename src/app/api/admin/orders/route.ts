import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";

// Quote-based bulk orders carry their lines in meta.bulk.items with
// no OrderItem rows - itemCount falls back to those so the admin
// console row never reads a misleading "0 items".
function bulkQtyOf(meta: unknown): number {
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return 0;
  }
  const bulk = (meta as Record<string, unknown>).bulk;
  if (bulk === null || typeof bulk !== "object" || Array.isArray(bulk)) {
    return 0;
  }
  const arr = (bulk as Record<string, unknown>).items;
  if (!Array.isArray(arr)) {
    return 0;
  }
  let sum = 0;
  for (const x of arr) {
    if (x !== null && typeof x === "object") {
      sum += Number((x as Record<string, unknown>).qty) || 0;
    }
  }
  return sum;
}

export async function GET(req: Request) {
  const gate = await requireAdminScope("orders");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const orders = await db.order.findMany({
    where: status && status !== "ALL" ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, phone: true } },
      nursery: { select: { name: true, city: true } },
      items: { select: { qty: true } },
      payment: { select: { method: true } },
    },
  });
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      mode: o.mode,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      buyer: o.user.name ?? o.user.phone,
      buyerPhone: o.user.phone,
      nurseryName: o.nursery.name,
      nurseryCity: o.nursery.city,
      itemCount:
        o.items.length > 0 ? o.items.reduce((sum, it) => sum + it.qty, 0) : bulkQtyOf(o.meta),
      paymentMethod: o.payment ? o.payment.method : null,
    })),
  });
}