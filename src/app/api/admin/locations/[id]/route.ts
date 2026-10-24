import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// Admin delivery-locations console — single-row API (mission X2).
//
// PATCH → edit one location. Every field is optional; at least one
//         must be present:
//           pincode  the identity — editable to fix typos, but a
//                    change that collides answers 409 "duplicate"
//           city     display city
//           state    display state
//           active   off rows keep their identity but stop
//                    appearing in the storefront dropdowns
//
// There is no delete: a serviceable pincode that later stops being
// serviceable is deactivated, so pasted history and audit trails
// stay honest. Scope: "locations".
// ─────────────────────────────────────────────────────────────

const PIN_RE = /^[1-9]\d{5}$/;

const PatchBody = z
  .object({
    pincode: z.string().trim().regex(PIN_RE, "pincode must be 6 digits, not starting with 0").optional(),
    city: z.string().trim().min(2).max(60).optional(),
    state: z.string().trim().max(60).optional(),
    active: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "empty patch" });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminScope("locations");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const existing = await db.serviceLocation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = parsed.data;
  const data: { pincode?: string; city?: string; state?: string; active?: boolean } = {};
  const changed: string[] = [];
  if (body.pincode !== undefined && body.pincode !== existing.pincode) {
    data.pincode = body.pincode;
    changed.push(`pincode ${existing.pincode} → ${body.pincode}`);
  }
  if (body.city !== undefined && body.city !== existing.city) {
    data.city = body.city;
    changed.push(`city “${existing.city}” → “${body.city}”`);
  }
  if (body.state !== undefined && body.state !== existing.state) {
    data.state = body.state;
    changed.push(`state “${existing.state}” → “${body.state}”`);
  }
  if (body.active !== undefined && body.active !== existing.active) {
    data.active = body.active;
    changed.push(body.active ? "reactivated" : "deactivated");
  }
  if (changed.length === 0) {
    return NextResponse.json({ ok: true, unchanged: true, location: existing });
  }

  try {
    const location = await db.serviceLocation.update({ where: { id }, data });
    await db.auditLog.create({
      data: {
        actorId: adminId,
        action: "location.update",
        entity: `ServiceLocation:${id}`,
        meta: { changes: changed },
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
