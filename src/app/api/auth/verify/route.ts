import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashOtp, rateOk, verifyLimiter } from "@/lib/security";

export async function POST(request: Request) {
  let body: { phone?: string; code?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const code = (body.code ?? "").trim();

  if (!/^\+91\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }

  const allowed = await rateOk(verifyLimiter, phone);

  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }

  const otp = await db.otpCode.findFirst({
    where: {
      phone: phone,
      consumed: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otp) {
    return NextResponse.json({ error: "No active code. Please request a new one." }, { status: 400 });
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 400 });
  }

  if (otp.attempts >= 5) {
    await db.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true },
    });

    return NextResponse.json({ error: "Too many wrong tries. Please request a new code." }, { status: 400 });
  }

  await db.otpCode.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  });

  if (hashOtp(phone, code) !== otp.hash) {
    return NextResponse.json({ error: "Wrong code. Try again." }, { status: 400 });
  }

  await db.otpCode.update({
    where: { id: otp.id },
    data: { consumed: true },
  });

  const user = await db.user.upsert({
    where: { phone: phone },
    update: {},
    create: {
      phone: phone,
    },
  });

  await createSession(user.id, user.role);

  return NextResponse.json({ ok: true, role: user.role });
}