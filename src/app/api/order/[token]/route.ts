import { NextResponse } from "next/server";
import { OrderStatus, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { computeOnTime, readTrustMeta, writeTrustIntoMeta } from "@/lib/trust";

// POST /api/order/[token] - the buyer's single platform action on the
// public order page: confirming receipt. No login - the unguessable
// tracking token IS the authorization (the /api/quote/[token]
// pattern). Confirming stamps meta.buyerConfirmedAt, writes a
// DELIVERED OrderEvent with actorRole CUSTOMER, and - when the
// supplier had not already marked DELIVERED - lands the final status
// flip. Supplier-side updates all happen in the seller console or
// via the WhatsApp commands (ACCEPT / OUT / DELIVERED / STATUS).
const CONFIRMABLE: OrderStatus[] = [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED];

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let body: { action?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action !== "confirm") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const order = await db.order.findUnique({
    where: { trackToken: token },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const meta = (order.meta ?? {}) as Record<string, unknown>;

  if (typeof meta.buyerConfirmedAt === "string") {
    return NextResponse.json(
      { error: "Receipt already confirmed", buyerConfirmedAt: meta.buyerConfirmedAt },
      { status: 409 },
    );
  }

  if (!CONFIRMABLE.includes(order.status)) {
    return NextResponse.json(
      { error: "This order is not out for delivery yet" },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();

  // Trust pack: the buyer's confirmation counts as the delivery
  // instant when the supplier has not already marked DELIVERED - the
  // same verdict math as the seller console (onTime vs the promised
  // IST day). writeTrustIntoMeta (S6-A fix) preserves meta.bulk.
  const patch: Record<string, string | boolean> = { buyerConfirmedAt: nowIso };

  if (typeof meta.deliveredAt !== "string") {
    const verdict = computeOnTime(readTrustMeta(order.meta).promisedDate, nowIso);
    patch.deliveredAt = nowIso;
    if (verdict !== null) {
      patch.onTime = verdict;
    }
  }

  const nextStatus =
    order.status === OrderStatus.OUT_FOR_DELIVERY ? OrderStatus.DELIVERED : order.status;

  await db.order.update({
    where: { id: order.id },
    data: {
      status: nextStatus,
      meta: writeTrustIntoMeta(order.meta, patch) as unknown as Prisma.InputJsonValue,
    },
  });

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      status: OrderStatus.DELIVERED,
      note: "Buyer confirmed receipt on the platform",
      actorRole: Role.CUSTOMER,
    },
  });

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    buyerConfirmedAt: nowIso,
  });
}