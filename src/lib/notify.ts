import { db } from "@/lib/db";
import { waText } from "@/lib/whatsapp";

function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export async function notifySellerNewOrder(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        nursery: { include: { owner: true } },
        payment: true,
      },
    });

    if (!order) {
      return;
    }

    const seller = order.nursery.owner;

    const binding = await db.whatsappBinding.upsert({
      where: { userId: seller.id },
      update: { lastAlertOrderId: order.id },
      create: {
        userId: seller.id,
        waId: seller.phone,
        lastAlertOrderId: order.id,
      },
    });

    const itemLines = order.items
      .map((it) => `${it.qty} × ${it.nameSnap}${it.vlabel ? ` (${it.vlabel})` : ""}`)
      .join("\n");

    const meta = order.meta as { cod?: boolean } | null;
    const isCod = (meta !== null && meta.cod === true) || order.payment?.method === "cod";

    const addr = order.address as { city?: string; pincode?: string } | null;
    const place = addr !== null && addr.city ? ` · Deliver to ${addr.city}${addr.pincode ? " " + addr.pincode : ""}` : "";

    const msg = [
      `🌱 New order ${order.code} for ${order.nursery.name}`,
      "",
      itemLines,
      "",
      `Total ${inr(order.total)} · ${isCod ? "Cash on delivery" : "Paid online"}${place}`,
      "",
      "Reply 1 to ACCEPT · 2 to REJECT",
    ].join("\n");

    await waText(binding.waId, msg);
  } catch (e) {
    console.error("[notify:error] seller alert failed:", e);
  }
}

export async function buyerUpdate(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        nursery: { select: { name: true } },
        payment: true,
        user: { select: { phone: true } },
      },
    });

    if (!order) {
      return;
    }

    const meta = order.meta as { cod?: boolean } | null;
    const isCod = (meta !== null && meta.cod === true) || order.payment?.method === "cod";

    let msg = "";

    if (order.status === "PENDING") {
      msg = `🌱 Order ${order.code} received. ${order.nursery.name} will confirm shortly. Total ${inr(order.total)}.`;
    } else if (order.status === "CONFIRMED") {
      msg = `✅ Order ${order.code} confirmed by ${order.nursery.name}. Your plants are being prepared.`;
    } else if (order.status === "PREPARING") {
      msg = `🪴 Order ${order.code}: ${order.nursery.name} is preparing your order.`;
    } else if (order.status === "OUT_FOR_DELIVERY") {
      const pin = order.deliveryOtp ? ` Your delivery PIN is ${order.deliveryOtp} — share it with the delivery person.` : "";
      const pay = isCod ? ` Please keep ${inr(order.total)} cash ready.` : "";
      msg = `🚚 Order ${order.code} from ${order.nursery.name} is out for delivery.${pin}${pay}`;
    } else if (order.status === "DELIVERED") {
      msg = `🌿 Order ${order.code} delivered. Happy growing! Thank you for buying from ${order.nursery.name}.`;
    } else if (order.status === "REJECTED") {
      const pay = isCod ? "" : " Any payment made will be refunded.";
      msg = `😔 Sorry, ${order.nursery.name} could not fulfil order ${order.code}.${pay}`;
    } else if (order.status === "CANCELLED") {
      msg = `Order ${order.code} has been cancelled.`;
    } else {
      return;
    }

    await waText(order.user.phone, msg);
  } catch (e) {
    console.error("[notify:error] buyer update failed:", e);
  }
}
export async function notifySellerCancelled(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { nursery: { include: { owner: true } } },
    });

    if (!order) {
      return;
    }

    const seller = order.nursery.owner;

    const binding = await db.whatsappBinding.upsert({
      where: { userId: seller.id },
      update: {},
      create: { userId: seller.id, waId: seller.phone },
    });

    const msg = [
      `🚫 Order ${order.code} was cancelled by the buyer.`,
      ``,
      `No action needed — stock has been returned automatically.`,
    ].join("\n");

    await waText(binding.waId, msg);
  } catch (e) {
    console.error("[notify:error] seller cancel alert failed:", e);
  }
}