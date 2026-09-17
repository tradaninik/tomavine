import { db } from "@/lib/db";
import { waText } from "@/lib/whatsapp";

export async function notifySellerNewOrder(orderId: string) {
  const o = await db.order.findUnique({ where: { id: orderId }, include: { items: true, nursery: true } });
  if (!o) return;
  await waText(o.nursery.phone, [
    `New order ${o.code}`,
    ...o.items.map(i => `${i.nameSnap} ×${i.qty}`),
    `${o.mode === "PICKUP" ? "Pickup" : (o.address as any).city} · Rs ${o.total}`,
    "", "Reply 1 to ACCEPT · 2 to REJECT", `Or manage: ${process.env.APP_URL}/seller/orders`,
  ].join("\n"));
  await db.whatsappBinding.upsert({
    where: { userId: o.nursery.ownerId },
    create: { userId: o.nursery.ownerId, waId: o.nursery.phone, lastAlertOrderId: o.id },
    update: { lastAlertOrderId: o.id },
  });
}

export async function buyerUpdate(orderId: string) {
  const o = await db.order.findUnique({ where: { id: orderId }, include: { user: true, nursery: true, payment: true } });
  if (!o) return;
  const map: Record<string, string> = {
    CONFIRMED: `Order ${o.code} confirmed by ${o.nursery.name}. Track: ${process.env.APP_URL}`,
    OUT_FOR_DELIVERY: `Order ${o.code} is out for delivery` + (o.payment?.method === "cod" ? `. Pay Rs ${o.total} — show this PIN: ${o.deliveryOtp}` : "."),
    DELIVERED: `Order ${o.code} delivered. Care tips and review: ${process.env.APP_URL}`,
    CANCELLED: `Order ${o.code} cancelled. Refund (if paid) in 3-5 days.`,
  };
  if (map[o.status]) await waText(o.user.phone, map[o.status]);
}