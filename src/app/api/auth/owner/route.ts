import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { createSession, rateOk, verifyLimiter } from "@/lib/security";

// POST /api/auth/owner — password sign-in for the OWNER only.
// Credentials live in env (OWNER_PHONE / OWNER_PASSWORD), never the DB.
// If either is unset the route 404s — nothing to attack. OTP flow is untouched.
export async function POST(request: Request) {
  const ownerPhone = process.env.OWNER_PHONE;
  const ownerPass = process.env.OWNER_PASSWORD;
  if (!ownerPhone || !ownerPass) {
    return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  }

  let body: { phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const password = body.password ?? "";

  if (!/^\+91\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }

  // Same limiter budget as OTP verify, own key prefix.
  if (!(await rateOk(verifyLimiter, "owner:" + phone))) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }

  const passOk =
    crypto.timingSafeEqual(
      crypto.createHmac("sha256", process.env.JWT_SECRET!).update(password).digest(),
      crypto.createHmac("sha256", process.env.JWT_SECRET!).update(ownerPass).digest(),
    );

  if (phone !== ownerPhone || !passOk) {
    return NextResponse.json({ error: "Wrong phone or password" }, { status: 401 });
  }

  // Identical session issuance to /api/auth/verify
  const user = await db.user.upsert({
    where: { phone: phone },
    update: {},
    create: { phone: phone },
  });

  await createSession(user.id, user.role);
  return NextResponse.json({ ok: true, role: user.role });
}