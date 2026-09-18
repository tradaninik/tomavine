import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

// GET /api/customer/orders — the logged-in customer's own orders, newest first.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = String(session.payload.sub);

  const orders = await db.order.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      nursery: { select: { name: true, slug: true, city: true } },
      items: { select: { qty: true } },
      review: { select: { id: true } },
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
      itemCount: o.items.reduce((n, item) => n + item.qty, 0),
      reviewed: o.review !== null,
      nursery: { name: o.nursery.name, slug: o.nursery.slug, city: o.nursery.city },
    })),
  });
}