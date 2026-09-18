import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || String(session.payload.role) !== "ADMIN") {
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
      itemCount: o.items.reduce((sum, it) => sum + it.qty, 0),
      paymentMethod: o.payment ? o.payment.method : null,
    })),
  });
}