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

// ── Seller-driven transition ladder (one rulebook for the single and
// bulk paths): PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY →
// DELIVERED. CANCELLED from PENDING/CONFIRMED (mirrors the buyer
// cancel window); REJECTED from PENDING only. The single path below
// enforces the exact same rungs inline, with per-action messages.
const LADDER: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.CONFIRMED]: [OrderStatus.PENDING],
  [OrderStatus.PREPARING]: [OrderStatus.CONFIRMED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
  [OrderStatus.DELIVERED]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.CANCELLED]: [OrderStatus.PENDING, OrderStatus.CONFIRMED],
  [OrderStatus.REJECTED]: [OrderStatus.PENDING],
};

// Timeline note recorded on each bulk transition — matches the notes
// the single-action path writes for the same destination status.
const BULK_NOTE: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.CONFIRMED]: "Order accepted by seller",
  [OrderStatus.PREPARING]: "Being prepared",
  [OrderStatus.OUT_FOR_DELIVERY]: "Out for delivery",
  [OrderStatus.DELIVERED]: "Delivered",
  [OrderStatus.CANCELLED]: "Cancelled by seller",
  [OrderStatus.REJECTED]: "Order rejected by seller",
};

type LoadedOrder = Prisma.OrderGetPayload<{ include: { items: true; payment: true } }>;

// Shared commit for every seller-driven transition. Writes the status
// flip + an OrderEvent row, restores stock for CANCELLED/REJECTED in
// the SAME transaction, handles terminal payment bookkeeping, and
// returns the fresh delivery PIN when the order went out.
async function commitSellerTransition(
  order: LoadedOrder,
  nextStatus: OrderStatus,
  note: string,
  extraMeta: Record<string, unknown> | null = null,
): Promise<string | null> {
  const deliveryOtp =
    nextStatus === OrderStatus.OUT_FOR_DELIVERY
      ? String(Math.floor(1000 + Math.random() * 9000))
      : null;

  const updateData: { status: OrderStatus; deliveryOtp?: string; meta?: Prisma.InputJsonValue } = { status: nextStatus };

  if (deliveryOtp) {
    updateData.deliveryOtp = deliveryOtp;
  }

  let metaPatch: Record<string, unknown> | null = extraMeta;

  if (nextStatus === OrderStatus.DELIVERED) {
    // ── Trust pack: record the delivery instant and compute the
    // verdict once — on time = delivered by END of the promised IST
    // day (timezone-aware; the DB stores UTC). No promised date →
    // no onTime key → the order can never show as late.
    const deliveredAt = new Date().toISOString();
    const verdict = computeOnTime(readTrustMeta(order.meta).promisedDate, deliveredAt);
    const patch: Record<string, unknown> = { deliveredAt: deliveredAt, ...extraMeta };
    if (verdict !== null) {
      patch.onTime = verdict;
    }
    metaPatch = writeTrustIntoMeta(order.meta, patch);
  }

  if (metaPatch !== null) {
    updateData.meta = metaPatch as Prisma.InputJsonValue;
  }

  const restoreStock = nextStatus === OrderStatus.REJECTED || nextStatus === OrderStatus.CANCELLED;

  if (restoreStock) {
    // A rejected/cancelled order never ships — give the stock back in
    // the SAME transaction that flips the status, so the two can
    // never disagree.
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
  //  - reject/cancel: CREATED -> FAILED, PAID -> REFUNDED (refund owed)
  //  - delivered + COD: cash collected at the door -> PAID
  // Online settlements happen in the Razorpay webhook only, never here.
  if (order.payment) {
    if (restoreStock) {
      if (order.payment.status === "CREATED") {
        await db.payment.update({ where: { id: order.payment.id }, data: { status: "FAILED" } });
      } else if (order.payment.status === "PAID") {
        await db.payment.update({ where: { id: order.payment.id }, data: { status: "REFUNDED" } });
      }
    } else if (
      nextStatus === OrderStatus.DELIVERED &&
      order.payment.method === "cod" &&
      order.payment.status === "CREATED"
    ) {
      await db.payment.update({ where: { id: order.payment.id }, data: { status: "PAID", capturedAt: new Date() } });
    }
  }

  return deliveryOtp;
}

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
      // ── ADDED (power pack): timeline events for the expandable
      // per-order panel. Additive — existing consumers ignore it.
      events: { orderBy: { createdAt: "asc" } },
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

  let body: { id?: string; action?: string; promisedDate?: string; ids?: unknown; status?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Bulk shape (additive): { ids: string[], status: OrderStatus }.
  // One status applied to many orders of this nursery; every order is
  // validated against the ladder individually and reported separately.
  if (Array.isArray(body.ids)) {
    return await patchBulk(nursery.id, body.ids, body.status);
  }

  // ── Single shape (unchanged contract): { id, action, promisedDate? }.
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
  let extraMeta: Record<string, unknown> | null = null;

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
      extraMeta = writeTrustIntoMeta(order.meta, {
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
  } else if (action === "prepare") {
    if (order.status !== OrderStatus.CONFIRMED) {
      return NextResponse.json({ error: "Only confirmed orders can be marked as being prepared" }, { status: 400 });
    }
    nextStatus = OrderStatus.PREPARING;
    note = "Being prepared";
  } else if (action === "cancel") {
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      return NextResponse.json({ error: "Only pending or confirmed orders can be cancelled" }, { status: 400 });
    }
    nextStatus = OrderStatus.CANCELLED;
    note = "Cancelled by seller";
  } else if (action === "out") {
    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PREPARING) {
      return NextResponse.json({ error: "Only confirmed orders can go out for delivery" }, { status: 400 });
    }
    nextStatus = OrderStatus.OUT_FOR_DELIVERY;
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

  const deliveryOtp = await commitSellerTransition(order, nextStatus, note, extraMeta);

  try {
    await buyerUpdate(order.id);
  } catch (e) {
    console.error("buyerUpdate failed for order " + order.code, e);
  }

  return NextResponse.json({ ok: true, status: nextStatus, deliveryOtp: deliveryOtp });
}

// PATCH body { ids, status } — one ladder-validated status applied to
// many orders. Per-order outcomes are reported so the UI can show
// exactly which rows moved and which were refused (and why). A
// failure on one order never blocks the others.
async function patchBulk(nurseryId: string, idsRaw: unknown[], statusRaw: unknown) {
  const status = typeof statusRaw === "string" ? (statusRaw as OrderStatus) : ("" as OrderStatus);
  const allowedFrom = LADDER[status];

  if (!allowedFrom) {
    return NextResponse.json({ error: "Unknown or unsupported bulk status" }, { status: 400 });
  }

  const ids = Array.from(
    new Set(idsRaw.filter((x): x is string => typeof x === "string" && x.length > 0)),
  );

  if (ids.length === 0) {
    return NextResponse.json({ error: "No orders selected" }, { status: 400 });
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: "Select at most 100 orders at once" }, { status: 400 });
  }

  const orders = await db.order.findMany({
    where: { id: { in: ids }, nurseryId: nurseryId },
    include: { items: true, payment: true },
  });

  const byId = new Map(orders.map((o) => [o.id, o]));

  const results: { id: string; code: string; ok: boolean; status?: OrderStatus; error?: string }[] = [];
  let updated = 0;

  for (const id of ids) {
    const order = byId.get(id);

    if (!order) {
      results.push({ id: id, code: "—", ok: false, error: "Order not found" });
      continue;
    }

    if (!allowedFrom.includes(order.status)) {
      results.push({
        id: id,
        code: order.code,
        ok: false,
        error: `Cannot change from ${order.status} to ${status}`,
      });
      continue;
    }

    try {
      await commitSellerTransition(order, status, BULK_NOTE[status] ?? "Updated by seller");
      updated += 1;
      results.push({ id: id, code: order.code, ok: true, status: status });

      try {
        await buyerUpdate(order.id);
      } catch (e) {
        console.error("buyerUpdate failed for order " + order.code, e);
      }
    } catch (e) {
      console.error("bulk transition failed for order " + order.code, e);
      results.push({ id: id, code: order.code, ok: false, error: "Update failed" });
    }
  }

  return NextResponse.json({ ok: true, updated: updated, results: results });
}
