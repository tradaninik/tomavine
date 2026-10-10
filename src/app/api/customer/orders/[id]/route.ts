import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

// GET /api/customer/orders/[id] — full detail of one of the customer's own orders.
// A foreign order id and a nonexistent id both return 404 (no existence leak).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = String(session.payload.sub);
  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id: id, userId: userId },
    include: {
      nursery: { select: { name: true, slug: true, city: true, phone: true } },
      items: {
        include: {
          product: { select: { nameEn: true, names: true, botanical: true, category: true } },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      review: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      code: order.code,
      status: order.status,
      mode: order.mode,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      tax: order.tax,
      discount: order.discount,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      address: order.address,
      deliveryOtp: order.deliveryOtp,
      meta: order.meta,
      nursery: order.nursery,
      items: order.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        variantId: it.variantId,
        qty: it.qty,
        unitPrice: it.unitPrice,
        nameSnap: it.nameSnap,
        vlabel: it.vlabel,
        product: it.product,
      })),
      events: order.events.map((ev) => ({
        id: ev.id,
        status: ev.status,
        note: ev.note,
        actorRole: ev.actorRole,
        createdAt: ev.createdAt.toISOString(),
      })),
      review: order.review
        ? {
            id: order.review.id,
            stars: order.review.stars,
            text: order.review.text,
            reply: order.review.reply,
            createdAt: order.review.createdAt.toISOString(),
          }
        : null,
    },
  });
}