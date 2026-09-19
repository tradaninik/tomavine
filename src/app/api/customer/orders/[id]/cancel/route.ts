import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

// POST /api/customer/orders/[id]/cancel — buyer cancellation.
// Allowed only while PENDING or CONFIRMED. Transactional: status → CANCELLED,
// a timeline event is recorded, and every item returns to nursery stock.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = String(session.payload.sub);
  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id: id, userId: userId },
    select: { id: true },
  });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const claimed = await db.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: id, userId: userId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    });
    if (res.count !== 1) {
      return false;
    }
    const items = await tx.orderItem.findMany({
      where: { orderId: id },
      select: { productId: true, qty: true },
    });
    for (const it of items) {
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { increment: it.qty } },
      });
    }
    await tx.orderEvent.create({
      data: {
        orderId: id,
        status: "CANCELLED",
        note: "Cancelled by buyer",
        actorRole: "CUSTOMER",
      },
    });
    return true;
  });

  if (!claimed) {
    return NextResponse.json({ error: "not_cancellable" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}