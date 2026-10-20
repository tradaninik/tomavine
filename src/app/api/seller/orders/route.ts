import { NextResponse } from "next/server";
import { OrderStatus, Role, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import { buyerUpdate } from "@/lib/notify";
import { validatePromisedDate, computeOnTime, readTrustMeta, writeTrustIntoMeta } from "@/lib/trust";

const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.OUT_FOR_DELIVERY,
];

export async function GET(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  const tab = new URL(request.url).searchParams.get("tab") ?? "active";

  const where =
    tab === "all"
      ? { nurseryId: nursery.id }
      : { nurseryId: nursery.id, status: { in: ACTIVE_STATUSES } };

  const orders = await db.order.findMany({
    where: where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: true,
      payment: true,
      user: { select: { name: true, phone: true } },
    },
  });

  return NextResponse.json({ orders: orders });
}

export async function PATCH(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: { id?: string; action?: string; promisedDate?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  const promisedDate = typeof body.promisedDate === "string" ? body.promisedDate : "";

  if (!id || !action) {
    return NextResponse.json({ error: "Missing order id or action" }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: { id: id, nurseryId: nursery.id },
    include: { items: true, payment: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let nextStatus: OrderStatus;
  let note = "";
  let deliveryOtp: string | null = null;
  let metaPatch: Record<string, string | number | boolean> | null = null;
  let restoreStock = false;

  if (action === "accept") {
    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json({ error: "Only pending orders can be accepted" }, { status: 400 });
    }
    nextStatus = OrderStatus.CONFIRMED;
    note = "Order accepted by seller";

    // ── Trust pack (S8 Wave B): optional promised delivery date.
    // DELIVERY orders only — a date sent for a PICKUP order is
    // ignored. Stored in Order.meta, preserving existing keys.
    if (promisedDate.length > 0 && order.mode === "DELIVERY") {
      const check = validatePromisedDate(promisedDate);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      metaPatch = writeTrustIntoMeta(order.meta, {
        promisedDate: check.value,
        promisedAt: new Date().toISOString(),
      });
    }
  } else if (action === "reject") {
    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json({ error: "Only pending orders can be rejected" }, { status: 400 });
    }
    nextStatus = OrderStatus.REJECTED;
    note = "Order rejected by seller";
    restoreStock = true;
  } else if (action === "out") {
    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PREPARING) {
      return NextResponse.json({ error: "Only confirmed orders can go out for delivery" }, { status: 400 });
    }
    nextStatus = OrderStatus.OUT_FOR_DELIVERY;
    deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
    note = "Out for delivery";
  } else if (action === "delivered") {
    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      return NextResponse.json({ error: "Only orders out for delivery can be marked delivered" }, { status: 400 });
    }
    nextStatus = OrderStatus.DELIVERED;
    note = "Delivered";

    // ── Trust pack: record the delivery instant and compute the
    // verdict once — on time = delivered by END of the promised IST
    // day (timezone-aware; the DB stores UTC). No promised date →
    // no onTime key → the order can never show as late.
    const deliveredAt = new Date().toISOString();
    const verdict = computeOnTime(readTrustMeta(order.meta).promisedDate, deliveredAt);
    const patch: Record<string, string | boolean> = { deliveredAt: deliveredAt };
    if (verdict !== null) {
      patch.onTime = verdict;
    }
    metaPatch = writeTrustIntoMeta(order.meta, patch);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updateData: { status: OrderStatus; deliveryOtp?: string; meta?: Prisma.InputJsonValue } = { status: nextStatus };

  if (deliveryOtp) {
    updateData.deliveryOtp = deliveryOtp;
  }

  if (metaPatch !== null) {
    updateData.meta = metaPatch as Prisma.InputJsonValue;
  }

  if (restoreStock) {
    // A rejected order never ships — give the stock back in the SAME
    // transaction that flips the status, so the two can never disagree
    // (previously rejection left stock decremented forever).
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });
      }
      await tx.order.update({ where: { id: order.id }, data: updateData });
      await tx.orderEvent.create({
        data: { orderId: order.id, status: nextStatus, note: note, actorRole: Role.SELLER },
      });
    });
  } else {
    await db.order.update({ where: { id: order.id }, data: updateData });

    await db.orderEvent.create({
      data: { orderId: order.id, status: nextStatus, note: note, actorRole: Role.SELLER },
    });
  }

  // Payment bookkeeping for terminal transitions:
  //  - reject: CREATED -> FAILED, PAID -> REFUNDED (refund owed)
  //  - delivered + COD: cash collected at the door -> PAID
  // Online settlements happen in the Razorpay webhook only, never here.
  if (order.payment) {
    if (action === "reject") {
      if (order.payment.status === "CREATED") {
        await db.payment.update({ where: { id: order.payment.id }, data: { status: "FAILED" } });
      } else if (order.payment.status === "PAID") {
        await db.payment.update({ where: { id: order.payment.id }, data: { status: "REFUNDED" } });
      }
    } else if (action === "delivered" && order.payment.method === "cod" && order.payment.status === "CREATED") {
      await db.payment.update({ where: { id: order.payment.id }, data: { status: "PAID", capturedAt: new Date() } });
    }
  }

  try {
    await buyerUpdate(order.id);
  } catch (e) {
    console.error("buyerUpdate failed for order " + order.code, e);
  }

  return NextResponse.json({ ok: true, status: nextStatus, deliveryOtp: deliveryOtp });
}