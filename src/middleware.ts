import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const h = res.headers;
  h.set("X-Frame-Options", "DENY");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(self), geolocation=(self)");
  h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  h.set("Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https://*.r2.dev https://picsum.photos; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
  return res;
}

export const config = { matcher: "/((?!_next/static|_next/image).*)" };