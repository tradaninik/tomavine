import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import { nurseryFeatureOn } from "@/lib/nursery-features";

// ─────────────────────────────────────────────────────────────
// Seller "Locations" console API (mission F).
//
// The nursery admin's home for "which pincodes do we serve":
//
//   GET  → { master, mine, canManage }
//          master — every ACTIVE ServiceLocation (suggestions)
//          mine   — this nursery's linked areas
//          canManage — features.locations switch (super admin)
//
//   POST → { pincode, city, state }. Adding a pincode nobody serves
//          yet creates the master row too — the master list grows
//          from the field, exactly like the Quiclo franchise model
//          the owner described. Picking an existing pincode keeps
//          its city/state labels (the admin's are ignored).
//
// Unlinking lives at DELETE /api/seller/locations/[id].
// Cap: 200 areas per nursery — plenty for real service areas,
// small enough to stop a runaway loop.
// ─────────────────────────────────────────────────────────────

const PIN_RE = /^[1-9]\d{5}$/;
const MAX_AREAS = 200;

export async function GET() {
  const auth = await requireNursery();
  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }
  const { nursery } = auth;

  const [master, mine] = await Promise.all([
    db.serviceLocation.findMany({
      where: { active: true },
      orderBy: [{ state: "asc" }, { city: "asc" }, { pincode: "asc" }],
      select: { id: true, pincode: true, city: true, state: true },
    }),
    db.nurseryServiceArea.findMany({
      where: { nurseryId: nursery.id },
      include: { location: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    master,
    mine: mine.map((sa) => ({
      locationId: sa.locationId,
      pincode: sa.location.pincode,
      city: sa.location.city,
      state: sa.location.state,
    })),
    canManage: nurseryFeatureOn(nursery.features, "locations"),
    maxAreas: MAX_AREAS,
  });
}

export async function POST(req: Request) {
  const auth = await requireNursery();
  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }
  const { nursery, session } = auth;

  if (!nurseryFeatureOn(nursery.features, "locations")) {
    return NextResponse.json(
      { error: "Your service locations are managed by Tomavine — contact support to change them." },
      { status: 403 },
    );
  }

  let body: { pincode?: unknown; city?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";

  if (!PIN_RE.test(pincode)) {
    return NextResponse.json({ error: "Pincode must be 6 digits, not starting with 0" }, { status: 400 });
  }
  if (city.length < 2 || city.length > 60) {
    return NextResponse.json({ error: "City must be 2–60 characters" }, { status: 400 });
  }
  if (state.length > 60) {
    return NextResponse.json({ error: "State must be 60 characters or fewer" }, { status: 400 });
  }

  const existingCount = await db.nurseryServiceArea.count({ where: { nurseryId: nursery.id } });
  if (existingCount >= MAX_AREAS) {
    return NextResponse.json(
      { error: `You already serve ${existingCount} pincodes — contact Tomavine support to add more.` },
      { status: 400 },
    );
  }

  // An existing master row wins: its labels stay canonical. Only a
  // brand-new pincode creates one (unique-pincode race → re-read).
  let location = await db.serviceLocation.findUnique({ where: { pincode: pincode } });
  if (!location) {
    try {
      location = await db.serviceLocation.create({ data: { pincode, city, state } });
    } catch {
      location = await db.serviceLocation.findUnique({ where: { pincode: pincode } });
      if (!location) {
        return NextResponse.json({ error: "Could not save that location — please retry." }, { status: 500 });
      }
    }
  }

  try {
    await db.nurseryServiceArea.create({
      data: { nurseryId: nursery.id, locationId: location.id },
    });
  } catch {
    return NextResponse.json({ error: `You already serve ${location.pincode} — ${location.city}.` }, { status: 409 });
  }

  await db.auditLog.create({
    data: {
      actorId: String(session.payload.sub),
      action: "nursery.location.add",
      entity: `Nursery:${nursery.id}`,
      meta: {
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        createdMaster: location.pincode === pincode,
        source: "seller",
      },
    },
  });

  return NextResponse.json({
    ok: true,
    area: { locationId: location.id, pincode: location.pincode, city: location.city, state: location.state },
  });
}
