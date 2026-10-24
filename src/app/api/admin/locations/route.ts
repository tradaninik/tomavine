import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// Admin delivery-locations console — collection API (mission X2).
//
// GET  → every row (active AND inactive), ordered state → city →
//        pincode. No pagination — the list is a curation tool,
//        expected in the hundreds at most.
//
// POST → two shapes, one endpoint:
//        • single  { pincode, city, state }        → one row
//        • bulk    { lines: "pin,city,state\n…" }  → paste-a-list
//          (state segment optional per line → "")
//
//        Bulk uses createMany + skipDuplicates so a paste that
//        contains repeats or already-known pincodes simply lands
//        the new ones and reports the rest as skipped. Single
//        create answers 409 "duplicate" so the form can say so.
//
// Scope: "locations" — new in X2. SUPER_ADMIN bypasses; admins
// with a null permission list are grandfathered in; an explicit
// list can grant it from Users & staff (which reads ADMIN_SCOPES).
// ─────────────────────────────────────────────────────────────

const PIN_RE = /^[1-9]\d{5}$/;

const SingleBody = z.object({
  pincode: z.string().trim().regex(PIN_RE, "pincode must be 6 digits, not starting with 0"),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().max(60).optional().default(""),
});

const BulkBody = z.object({
  lines: z.string().trim().min(3).max(20000),
});

// "500001, Hyderabad, Telangana" / "500001	Hyderabad" — commas or
// tabs both accepted; the state segment is optional.
function parseBulk(raw: string): { rows: { pincode: string; city: string; state: string }[]; skipped: string[] } {
  const rows: { pincode: string; city: string; state: string }[] = [];
  const skipped: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) {
      continue;
    }
    const parts = text.split(/[,\t]/).map((p) => p.trim());
    const pincode = parts[0] ?? "";
    const city = parts[1] ?? "";
    const state = parts[2] ?? "";
    if (PIN_RE.test(pincode) && city.length >= 2 && state.length <= 60) {
      rows.push({ pincode, city, state });
    } else {
      skipped.push(text.slice(0, 60));
    }
  }
  return { rows, skipped };
}

export async function GET() {
  const gate = await requireAdminScope("locations");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const locations = await db.serviceLocation.findMany({
    orderBy: [{ state: "asc" }, { city: "asc" }, { pincode: "asc" }],
  });
  return NextResponse.json({ locations });
}

export async function POST(req: Request) {
  const gate = await requireAdminScope("locations");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const isBulk = "lines" in raw && typeof (raw as { lines?: unknown }).lines === "string";

  if (isBulk) {
    const parsed = BulkBody.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const { rows, skipped } = parseBulk(parsed.data.lines);
    if (rows.length === 0) {
      return NextResponse.json({ error: "no_valid_lines", skipped }, { status: 400 });
    }
    // skipDuplicates: repeats inside the paste AND already-known
    // pincodes both land in "skipped" territory — the response says
    // how many actually landed.
    const result = await db.serviceLocation.createMany({
      data: rows,
      skipDuplicates: true,
    });
    const added = result.count;
    await db.auditLog.create({
      data: {
        actorId: adminId,
        action: "location.create",
        entity: "ServiceLocation:bulk",
        meta: { requested: rows.length, added, skippedInvalid: skipped.length },
      },
    });
    return NextResponse.json({
      ok: true,
      added,
      requested: rows.length,
      duplicates: rows.length - added,
      skipped,
    });
  }

  const parsed = SingleBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { pincode, city, state } = parsed.data;
  try {
    const location = await db.serviceLocation.create({ data: { pincode, city, state } });
    await db.auditLog.create({
      data: {
        actorId: adminId,
        action: "location.create",
        entity: `ServiceLocation:${location.id}`,
        meta: { pincode, city, state },
      },
    });
    return NextResponse.json({ ok: true, location });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    throw e;
  }
}
