import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, verifyRazorpayCheckout } from "@/lib/security";
import { buyerUpdate } from "@/lib/notify";

const Body = z.object({
  rzpOrderId: z.string().min(4),
  rzpPaymentId: z.string().min(4),
  signature: z.string().min(8),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });

  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const payment = await db.payment.findUnique({
    where: { rzpOrderId: p.data.rzpOrderId },
    include: { order: true },
  });
  if (!payment || !payment.order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Only the buyer of this order may verify its payment.
  if (payment.order.userId !== session.payload.sub) {
    return NextResponse.json({ error: "auth" }, { status: 403 });
  }
  if (!verifyRazorpayCheckout(p.data.rzpOrderId, p.data.rzpPaymentId, p.data.signature)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }
  // Idempotent: webhook may have already marked PAID - never double-notify.
  if (payment.status === "PAID") {
    return NextResponse.json({ ok: true, already: true });
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", rzpPaymentId: p.data.rzpPaymentId, capturedAt: new Date() },
  });

  try {
    await buyerUpdate(payment.order.id);
  } catch (e) {
    console.error("buyerUpdate failed for " + payment.order.code, e);
  }
  return NextResponse.json({ ok: true });
}