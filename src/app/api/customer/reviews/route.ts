import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";
import { writeTrustIntoMeta } from "@/lib/trust";

// POST /api/customer/reviews — one review per DELIVERED order, targeting a
// product from that order. Recomputes the nursery's ratingAvg in the same
// transaction, so the storefront rating can never drift from the reviews.
// Optional deliveryRating (1–5) rides the same transaction and is stored in
// Order.meta — the delivery-experience half of the trust pack (S8 Wave B).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = String(session.payload.sub);

  const body = (await req.json().catch(() => null)) as {
    orderId?: unknown;
    productId?: unknown;
    stars?: unknown;
    text?: unknown;
    deliveryRating?: unknown;
  } | null;

  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const stars =
    typeof body?.stars === "number" && Number.isFinite(body.stars) ? Math.round(body.stars) : 0;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const deliveryRating =
    typeof body?.deliveryRating === "number" && Number.isFinite(body.deliveryRating)
      ? Math.round(body.deliveryRating)
      : 0;

  if (orderId.length === 0 || productId.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (stars < 1 || stars > 5) {
    return NextResponse.json({ error: "bad_stars" }, { status: 400 });
  }
  if (text.length < 3 || text.length > 1000) {
    return NextResponse.json({ error: "bad_text" }, { status: 400 });
  }
  if (deliveryRating !== 0 && (deliveryRating < 1 || deliveryRating > 5)) {
    return NextResponse.json({ error: "bad_delivery_rating" }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: { id: orderId, userId: userId },
    include: {
      items: { select: { productId: true } },
      review: { select: { id: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== "DELIVERED") {
    return NextResponse.json({ error: "not_delivered" }, { status: 409 });
  }
  if (order.review !== null) {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }
  if (!order.items.some((it) => it.productId === productId)) {
    return NextResponse.json({ error: "not_in_order" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        productId: productId,
        userId: userId,
        orderId: orderId,
        stars: stars,
        text: text,
      },
    });

    if (deliveryRating >= 1 && order.mode === "DELIVERY") {
      const merged = writeTrustIntoMeta(order.meta, {
        deliveryRating: deliveryRating,
        deliveryRatedAt: new Date().toISOString(),
      });
      await tx.order.update({
        where: { id: order.id },
        data: { meta: merged as Prisma.InputJsonValue },
      });
    }

    const agg = await tx.review.aggregate({
      where: { product: { nurseryId: order.nurseryId } },
      _avg: { stars: true },
    });

    const avg = agg._avg.stars === null ? 0 : agg._avg.stars;
    await tx.nursery.update({
      where: { id: order.nurseryId },
      data: { ratingAvg: Math.round(avg * 10) / 10 },
    });
  });

  return NextResponse.json({ ok: true });
}