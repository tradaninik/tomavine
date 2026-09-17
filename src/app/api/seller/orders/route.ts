import { NextResponse } from "next/server";
import { OrderStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import { buyerUpdate } from "@/lib/notify";

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

  let body: { id?: string; action?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!id || !action) {
    return NextResponse.json({ error: "Missing order id or action" }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: { id: id, nurseryId: nursery.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let nextStatus: OrderStatus;
  let note = "";
  let deliveryOtp: string | null = null;

  if (action === "accept") {
    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json({ error: "Only pending orders can be accepted" }, { status: 400 });
    }
    nextStatus = OrderStatus.CONFIRMED;
    note = "Order accepted by seller";
  } else if (action === "reject") {
    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json({ error: "Only pending orders can be rejected" }, { status: 400 });
    }
    nextStatus = OrderStatus.REJECTED;
    note = "Order rejected by seller";
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
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updateData: { status: OrderStatus; deliveryOtp?: string } = { status: nextStatus };

  if (deliveryOtp) {
    updateData.deliveryOtp = deliveryOtp;
  }

  await db.order.update({
    where: { id: order.id },
    data: updateData,
  });

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      status: nextStatus,
      note: note,
      actorRole: Role.SELLER,
    },
  });

  try {
    await buyerUpdate(order.id);
  } catch (e) {
    console.error("buyerUpdate failed for order " + order.code, e);
  }

  return NextResponse.json({ ok: true, status: nextStatus, deliveryOtp: deliveryOtp });
}