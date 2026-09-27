import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/permissions";

const CATEGORY_VALUES = ["plants", "saplings", "inputs", "pots", "tools"] as const;

const SettingsBody = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+91[6-9]\d{9}$/),
  gstin: z.string().trim().regex(/^[0-9A-Za-z]{15}$/),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(120),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  scope: z.enum(["RADIUS", "CITY", "STATE", "INDIA"]),
  scopeKm: z.number().int().min(1).max(100).nullable(),
  retailOk: z.boolean(),
  bulkOk: z.boolean(),
  growArea: z.string().trim().max(200).nullable(),
  categories: z.array(z.enum(CATEGORY_VALUES)).nullable(),
});

// PATCH /api/admin/nurseries/[id]/settings — SUPER_ADMIN edits a nursery's
// details. Status keeps its dedicated verify/reject route; slug is the public
// URL identity and never changes here. Categories: null means all five are
// allowed (the default for every pre-existing nursery); an explicit array is
// an exact allow-list. All five ticked is saved as null. One audit entry per
// real change.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const { id } = await ctx.params;
  const parsed = SettingsBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const body = parsed.data;
  if (!body.retailOk && !body.bulkOk) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (body.scope === "RADIUS" && body.scopeKm === null) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (body.categories !== null && body.categories.length === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const nursery = await db.nursery.findUnique({ where: { id: id } });
  if (!nursery) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const gstin = body.gstin.toUpperCase();
  const scopeKm = body.scope === "RADIUS" ? body.scopeKm : null;
  const growArea = body.growArea !== null && body.growArea.length > 0 ? body.growArea : null;
  const uniqueCats = body.categories !== null ? Array.from(new Set(body.categories)) : null;
  const categories = uniqueCats !== null && uniqueCats.length === CATEGORY_VALUES.length ? null : uniqueCats;

  const beforeCats =
    nursery.categories === null ? null : JSON.stringify((nursery.categories as string[]).slice().sort());
  const afterCats = categories === null ? null : JSON.stringify(categories.slice().sort());

  const changed: string[] = [];
  if (nursery.name !== body.name) changed.push("name");
  if (nursery.phone !== body.phone) changed.push("phone");
  if (nursery.gstin !== gstin) changed.push("gstin");
  if (nursery.city !== body.city) changed.push("city");
  if (nursery.area !== body.area) changed.push("area");
  if (nursery.pincode !== body.pincode) changed.push("pincode");
  if (nursery.scope !== body.scope) changed.push("scope");
  if (nursery.scopeKm !== scopeKm) changed.push("scopeKm");
  if (nursery.retailOk !== body.retailOk) changed.push("retailOk");
  if (nursery.bulkOk !== body.bulkOk) changed.push("bulkOk");
  if (nursery.growArea !== growArea) changed.push("growArea");
  if (beforeCats !== afterCats) changed.push("categories");

  if (changed.length === 0) {
    return NextResponse.json({ ok: true, changed: [] });
  }

  await db.$transaction(async (tx) => {
    await tx.nursery.update({
      where: { id: id },
      data: {
        name: body.name,
        phone: body.phone,
        gstin: gstin,
        city: body.city,
        area: body.area,
        pincode: body.pincode,
        scope: body.scope,
        scopeKm: scopeKm,
        retailOk: body.retailOk,
        bulkOk: body.bulkOk,
        growArea: growArea,
        categories: categories !== null ? (categories as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "nursery.update",
        entity: `Nursery:${nursery.id}`,
        meta: {
          name: body.name,
          slug: nursery.slug,
          city: body.city,
          changed: changed.join(", "),
          categories: categories === null ? "all" : categories.join(", "),
          source: "admin",
        },
      },
    });
  });
  return NextResponse.json({ ok: true, changed: changed });
}