import { db } from "@/lib/db";
import { waText } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/site";

// Mission S6-A fix: quotation lines for quote-based bulk orders ride
// in meta.bulk.items (no OrderItem rows) - surfaced wherever the
// classic items list is empty.
function bulkAlertLinesOf(meta: unknown): string {
  if (meta === null || typeof meta !== "object") {
    return "";
  }
  const bulk = (meta as Record<string, unknown>).bulk;
  if (bulk === null || typeof bulk !== "object" || Array.isArray(bulk)) {
    return "";
  }
  const arr = (bulk as Record<string, unknown>).items;
  if (!Array.isArray(arr)) {
    return "";
  }
  return arr
    .map((x) => {
      if (x === null || typeof x !== "object") {
        return "";
      }
      const r = x as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : "";
      return name.length > 0 ? String(Number(r.qty) || 0) + " x " + name : "";
    })
    .filter((s) => s.length > 0)
    .join("\n");
}

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

    // Mission S6-A fix: quote-based bulk orders have no OrderItem rows
    // - the seller alert falls back to the meta.bulk.items lines so
    // the WhatsApp message lists what to source.
    const alertLines =
      itemLines.length > 0
        ? itemLines
        : bulkAlertLinesOf(order.meta);

    const addr = order.address as { city?: string; pincode?: string } | null;
    const place = addr !== null && addr.city ? ` · Deliver to ${addr.city}${addr.pincode ? " " + addr.pincode : ""}` : "";

    const msg = [
      `🌱 New order ${order.code} for ${order.nursery.name}`,
      "",
      alertLines,
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

    // Mission S6-A fix: the tracking token lives on the Order column
    // (it was never written into meta) - every buyer update for an
    // order that has one ends with the link, so the timeline is
    // always one tap away, even for buyers who never log in.
    if (msg.length > 0 && typeof order.trackToken === "string" && order.trackToken.length > 0) {
      msg = msg + "\nTrack your order: " + SITE_URL + "/order/" + order.trackToken;
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