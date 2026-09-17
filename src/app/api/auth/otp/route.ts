import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { rateOk, otpLimiter, hashOtp } from "@/lib/security";
import { waText } from "@/lib/whatsapp";

const Body = z.object({ phone: z.string().regex(/^\+91[6-9]\d{9}$/) });

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { phone } = p.data;
  if (!(await rateOk(otpLimiter, phone))) return NextResponse.json({ error: "too_many" }, { status: 429 });

  const code = String(crypto.randomInt(100000, 999999));
  await db.otpCode.create({ data: { phone, hash: hashOtp(phone, code), expiresAt: new Date(Date.now() + 600000) } });
  const sent = await waText(phone, `Your Tomavine code is ${code}. Valid 10 minutes.`);
  // If WhatsApp isn't configured yet, the code is visible in your server logs
  // (locally: the terminal; on Vercel: Deployments -> Runtime Logs).
  return NextResponse.json({ ok: true, via: sent ? "whatsapp" : "server-logs" });
}