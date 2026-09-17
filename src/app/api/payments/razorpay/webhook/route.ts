import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyRazorpay } from "@/lib/security";
import { buyerUpdate } from "@/lib/notify";

export async function POST(req: Request) {
  const raw = await req.text();                                     // RAW body — required for HMAC
  const signature = req.headers.get("x-razorpay-signature")!;
  if (!verifyRazorpay(raw, signature)) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(raw);
  const dedupeKey = event.id ?? `${event.event}:${event.payload?.payment?.entity?.id}`;
  try {
    await db.webhookEvent.create({ data: { provider: "razorpay", eventId: dedupeKey, payload: event } });
  } catch { return NextResponse.json({ ok: true, duplicate: true }); }   // idempotent

  if (event.event === "payment.captured") {
    const p = event.payload.payment.entity;
    const payment = await db.payment.update({
      where: { rzpOrderId: p.order_id },
      data: { status: "PAID", rzpPaymentId: p.id, method: p.method, capturedAt: new Date() },
      include: { order: true },
    });
    // Marketplace split: transfer to the nursery's linked account minus commission.
    // Only runs when the nursery has completed Razorpay KYC (a linkedAccountId exists).
    // For now your test nursery has none, so transfers are skipped — everything else works.
    const linkedAccountId = (payment.order as any).linkedAccountId ?? null;
    if (linkedAccountId && process.env.RAZORPAY_KEY_ID) {
      const commission = Math.round(payment.amount * 0.05);
      await fetch(`https://api.razorpay.com/v1/payments/${p.id}/transfers`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_SECRET}`).toString("base64")}` },
        body: JSON.stringify({ transfers: [{ account: linkedAccountId, amount: payment.amount - commission, currency: "INR" }] }),
      });
    }
    await buyerUpdate(payment.order.id);                              // WhatsApp: buyer gets order-confirmed update
  }
  return NextResponse.json({ ok: true });
}