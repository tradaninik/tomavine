import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

let redis: Redis | null = null;
if (process.env.UPSTASH_URL && process.env.UPSTASH_TOKEN) {
  redis = new Redis({ url: process.env.UPSTASH_URL, token: process.env.UPSTASH_TOKEN });
}

// Rate limits — OTP brute-force and API abuse
const mk = (prefix: string, limit: number, window: string) =>
  redis ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(limit, window), prefix }) : null;
export const otpLimiter = mk("otp", 3, "10 m");
export const verifyLimiter = mk("verify", 10, "10 m");
export async function rateOk(l: Ratelimit | null, k: string) {
  if (!l) return true;
  try {
    return (await l.limit(k)).success;
  } catch (e) {
    console.warn("[rate] limiter unreachable — allowing request (fail-open)");
    return true;
  }
}

// Razorpay webhook: HMAC over the RAW body (never parsed JSON)
export function verifyRazorpay(rawBody: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// Meta webhook: X-Hub-Signature-256, timing-safe
export function verifyMeta(rawBody: string, header: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.WA_APP_SECRET!).update(rawBody).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const hashOtp = (phone: string, code: string) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET!).update(`${phone}:${code}`).digest("hex");

const key = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export async function createSession(userId: string, role: string) {
  const token = await new SignJWT({ role }).setSubject(userId)
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(key());
  (await cookies()).set("nh_session", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const token = (await cookies()).get("nh_session")?.value;
  if (!token) return null;
  try { return await jwtVerify(token, key()); } catch { return null; }
}

export async function requireRole(...roles: string[]) {   // RBAC gate for every mutating route
  const s = await getSession();
  if (!s) throw new Response("Unauthorized", { status: 401 });
  if (roles.length && !roles.includes(s.payload.role as string))
    throw new Response("Forbidden", { status: 403 });
  return s;
}