import { NextResponse } from "next/server";
import { OrderStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

// Buyer-side single-order actions. The shop order pages are reads;
// this route exists for the one thing a buyer must be able to DO:
// cancel while the order is still cancellable (PENDING or CONFIRMED).
// Once a nursery is preparing/dispatching, cancellation is a
// contact-the-seller matter (later batch).

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });

  const order = await db.order.findFirst({
    where: { id: (await ctx.params).id, userId: session.payload.sub },
    include: {
      items: true,
      payment: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (body.action !== "cancel") return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  const order = await db.order.findFirst({
    where: { id: (await ctx.params).id, userId: session.payload.sub },
    include: { items: true, payment: true },
  });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
    return NextResponse.json({ error: "not_cancellable" }, { status: 409 });
  }

  try {
    await db.$transaction(async (tx) => {
      // Stock back first, same discipline as checkout: the cancel
      // either fully lands or nothing changes.
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.CANCELLED,
          actorRole: Role.CUSTOMER,
          note: "Cancelled by buyer",
        },
      });
      // CREATED (never collected) -> FAILED. PAID -> REFUNDED flag so
      // ops can see a refund is owed; executing it via Razorpay is
      // the payments batch, not this one.
      if (order.payment && order.payment.status === "CREATED") {
        await tx.payment.update({ where: { id: order.payment.id }, data: { status: "FAILED" } });
      } else if (order.payment && order.payment.status === "PAID") {
        await tx.payment.update({ where: { id: order.payment.id }, data: { status: "REFUNDED" } });
      }
    });
  } catch (e) {
    console.error("buyer cancel failed for " + order.code, e);
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: OrderStatus.CANCELLED });
}