import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Mission S3: live site settings for client components (product-page
// tier hints, cart chips, WhatsApp buttons). Always the sanitized
// shape; nothing from the client is ever trusted.
export async function GET() {
  const s = await getSettings();
  return NextResponse.json(
    { tiers: s.tiers, maxQty: s.maxQty, preorderEnabled: s.preorderEnabled, whatsappNumber: s.whatsappNumber },
    { headers: { "Cache-Control": "no-store" } }
  );
}