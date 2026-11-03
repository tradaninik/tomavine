import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, rateOk, verifyLimiter } from "@/lib/security";
import { DEMO_PASSWORD, DEMO_USERS, demoUserByEmail } from "@/lib/demo-users";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------
// Demo sign-in - mission DEMO-1.
//
// GET  /api/auth/demo -> capability probe + account list for the
//   login page demo tab. 404 (and no tab) whenever DEMO_LOGIN is
//   unset, so the surface stays invisible on deployments that have
//   not opted in. Never returns passwords.
//
// POST /api/auth/demo -> demo email/password sign-in. Mirrors
//   /api/auth/owner: env-gated, rate-limited, timing-safe compare,
//   identical session issuance. The OTP flow is untouched.
// ----------------------------------------------------------------

export async function GET() {
  if (process.env.DEMO_LOGIN !== "1") {
    return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  }
  return NextResponse.json(
    {
      ok: true,
      users: DEMO_USERS.map((u) => ({ email: u.email, role: u.role, note: u.note })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (process.env.DEMO_LOGIN !== "1") {
    return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  // Same limiter budget as OTP verify + owner sign-in, own key
  // prefix - and it runs before the registry lookup so unknown
  // emails burn the same budget as wrong passwords.
  if (!(await rateOk(verifyLimiter, "demo:" + email))) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }

  const demo = demoUserByEmail(email);
  if (!demo) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  // Timing-safe compare against the shared demo password (same HMAC
  // construction as /api/auth/owner; the digests are always 32
  // bytes, so timingSafeEqual never throws on length).
  const passOk = crypto.timingSafeEqual(
    crypto.createHmac("sha256", process.env.JWT_SECRET!).update(password).digest(),
    crypto.createHmac("sha256", process.env.JWT_SECRET!).update(DEMO_PASSWORD).digest(),
  );
  if (!passOk) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  // Upsert by phone (the platform's identity). Every sign-in
  // rewrites the profile fields, so the accounts self-heal.
  const user = await db.user.upsert({
    where: { phone: demo.phone },
    update: {
      name: demo.name,
      role: demo.role,
      city: demo.city ?? null,
      pincode: demo.pincode ?? null,
      permissions: demo.permissions ? (demo.permissions as Prisma.InputJsonValue) : Prisma.DbNull,
    },
    create: {
      phone: demo.phone,
      name: demo.name,
      role: demo.role,
      city: demo.city,
      pincode: demo.pincode,
      permissions: demo.permissions ? (demo.permissions as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });

  // SELLER accounts own their nursery: heal the link if it drifted
  // (seed re-runs recreate rows; a stale ownerId breaks /seller).
  if (demo.nurserySlug) {
    const nursery = await db.nursery.findUnique({ where: { slug: demo.nurserySlug } });
    if (nursery && nursery.ownerId !== user.id) {
      await db.nursery.update({ where: { id: nursery.id }, data: { ownerId: user.id } });
    }
  }

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "auth.demo_login",
      entity: "User:" + user.id,
      meta: { email: demo.email, role: demo.role },
    },
  });

  await createSession(user.id, user.role);
  return NextResponse.json({ ok: true, role: user.role });
}
