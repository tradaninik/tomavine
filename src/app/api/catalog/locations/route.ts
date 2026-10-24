import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// GET /api/catalog/locations → the active serviceable pincodes.
//
// Public read API, same trust level as /api/catalog/taxonomy: the
// storefront pincode inputs (nurseries search, checkout address,
// sell application) turn this list into <datalist> suggestions.
// Picking a suggestion fills the input with the pincode only —
// the city/state text rides along as the option's label, so the
// 6-digit validation on each input is never disturbed.
//
// An empty list is a valid state: the owner hasn't pasted their
// serviceable pincodes yet, and every input behaves exactly as it
// did before (free text, 6-digit validation).
// ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const locations = await db.serviceLocation.findMany({
      where: { active: true },
      orderBy: [{ state: "asc" }, { city: "asc" }, { pincode: "asc" }],
      select: { pincode: true, city: true, state: true },
    });
    return NextResponse.json({ locations });
  } catch (e) {
    console.warn("[locations] read failed:", e);
    return NextResponse.json({ error: "db_unavailable" }, { status: 500 });
  }
}
