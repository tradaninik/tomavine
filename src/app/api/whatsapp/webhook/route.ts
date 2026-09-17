import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMeta } from "@/lib/security";
import { waText, waMarkRead } from "@/lib/whatsapp";

export async function GET(req: Request) {                              // Meta verification handshake
  const { searchParams } = new URL(req.url);
  if (searchParams.get("hub.mode") === "subscribe" && searchParams.get("hub.verify_token") === process.env.WA_VERIFY_TOKEN)
    return new Response(searchParams.get("hub.challenge"));
  return new Response("forbidden", { status: 403 });
}

const CMD = /^(ACCEPT|REJECT|OUT|DONE|DELIVERED|CANCEL|STATUS)\s*([A-Z0-9-]*)$/i;
// Also accept the numeric replies our alerts ask for: "1" = accept, "2" = reject
function normalize(text: string): string {
  if (text === "1") return "ACCEPT";
  if (text === "2") return "REJECT";
  return text;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMeta(raw, req.headers.get("x-hub-signature-256") ?? "")) return new Response("bad sig", { status: 400 });

  const body = JSON.parse(raw);
  for (const entry of body.entry ?? [])
    for (const change of entry.changes ?? []) {
      const msg = change.value.messages?.[0];
      if (!msg) continue;
      const from = msg.from;                                          // WhatsApp ID = phone with 91
      const text = normalize(msg.text?.body?.trim() ?? "");
      await waMarkRead(msg.id);

      const binding = await db.whatsappBinding.findUnique({ where: { waId: from }, include: { user: true } });
      if (!binding) { await waText(from, "Send START to link your account."); continue; }
      const m = text.match(CMD);
      if (!m) continue;

      const [, verb, codeArg] = m;
      const binding2 = await db.whatsappBinding.findUnique({ where: { waId: from } });
      let order = codeArg
        ? await db.order.findUnique({ where: { code: codeArg.toUpperCase() }, include: { nursery: true, items: true } })
        : await db.order.findUnique({ where: { id: binding2!.lastAlertOrderId ?? "" }, include: { nursery: true, items: true } });
      if (!order) { await waText(from, "Order not found."); continue; }

      // RBAC over WhatsApp: sellers may only act on THEIR nursery's orders; customers only on their own
      const isSeller = binding.user.role === "SELLER" && order.nursery.ownerId === binding.user.id;
      const isCustomer = order.userId === binding.user.id;

      if (verb.match(/ACCEPT/i) && isSeller && order.status === "PENDING") {
        await db.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
        await db.orderEvent.create({ data: { orderId: order.id, status: "CONFIRMED", actorRole: "SELLER" } });
        await waText(from, `Accepted ${order.code}. Reply OUT when dispatched, DELIVERED at handover.`);
      } else if (verb.match(/OUT/i) && isSeller && ["CONFIRMED", "PREPARING"].includes(order.status)) {
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        await db.order.update({ where: { id: order.id }, data: { status: "OUT_FOR_DELIVERY", deliveryOtp: otp } });
        await waText(from, `Marked out. Buyer received their delivery PIN: ${otp}. Ask it at handover.`);
      } else if (verb.match(/DELIVERED|DONE/i) && isSeller && order.status === "OUT_FOR_DELIVERY") {
        await db.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
        await waText(from, `Delivered ${order.code}. Review request will be sent to the buyer.`);
      } else if (verb.match(/CANCEL/i) && isCustomer && order.status === "PENDING") {
        await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
        await waText(from, `Cancelled ${order.code}. Refund (if paid) starts automatically.`);
      } else if (verb.match(/STATUS/i) && (isSeller || isCustomer)) {
        await waText(from, `${order.code}: ${order.status}`);
      } else {
        await waText(from, "Not allowed for this order.");
      }
      await db.whatsappLog.create({ data: { waId: from, body: text, direction: "in", status: "ok" } });
    }
  return NextResponse.json({ ok: true });     // always 200 — Meta retries on non-2xx and we are idempotent
}