import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// POST /api/auth/logout — clears the session cookie.
// Idempotent: always returns ok, even if there was no session.
export async function POST() {
  (await cookies()).set("nh_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}