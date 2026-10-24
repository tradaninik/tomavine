import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope, requireSuperAdmin } from "@/lib/permissions";

export async function GET(req: Request) {
  const gate = await requireAdminScope("nurseries");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const nurseries = await db.nursery.findMany({
    where: status === "PENDING" || status === "VERIFIED" || status === "REJECTED" ? { status: status } : {},
    include: {
      owner: { select: { name: true, phone: true } },
      serviceAreas: { include: { location: true } },
      _count: { select: { products: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({
    nurseries: nurseries.map((n) => ({
      id: n.id,
      name: n.name,
      slug: n.slug,
      phone: n.phone,
      gstin: n.gstin,
      city: n.city,
      area: n.area,
      pincode: n.pincode,
      scope: n.scope,
      scopeKm: n.scopeKm,
      bulkOk: n.bulkOk,
      retailOk: n.retailOk,
      status: n.status,
      physVerifiedAt: n.physVerifiedAt ? n.physVerifiedAt.toISOString() : null,
      growArea: n.growArea,
      categories: n.categories,
      features: n.features,
      serviceAreas: n.serviceAreas
        .slice()
        .sort((a, b) => a.location.pincode.localeCompare(b.location.pincode))
        .map((sa) => ({
          locationId: sa.locationId,
          pincode: sa.location.pincode,
          city: sa.location.city,
          state: sa.location.state,
        })),
      ratingAvg: n.ratingAvg,
      productCount: n._count.products,
      ownerName: n.owner.name,
      ownerPhone: n.owner.phone,
    })),
  });
}

const CreateBody = z.object({
  ownerName: z.string().trim().min(2).max(80),
  ownerPhone: z.string().trim().regex(/^\+91[6-9]\d{9}$/),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+91[6-9]\d{9}$/),
  gstin: z.string().trim().regex(/^[0-9A-Za-z]{15}$/),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(120),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  scope: z.enum(["RADIUS", "CITY", "STATE", "INDIA"]),
  scopeKm: z.number().int().min(1).max(100).nullable(),
  bulkOk: z.boolean(),
  retailOk: z.boolean(),
  growArea: z.string().trim().max(200).nullable(),
  // Mission F: service areas the super admin picks while creating the
  // nursery. Optional — a brand-new nursery can start empty and the
  // nursery admin adds their own pincodes from the seller console.
  locationIds: z.array(z.string().trim().min(1)).max(200).optional().default([]),
});

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "nursery";
}

// POST /api/admin/nurseries — SUPER_ADMIN onboards a new nursery:
// creates the owner (SELLER) + the nursery (PENDING) + an audit entry in one transaction.
export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
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
  const existing = await db.user.findUnique({ where: { phone: body.ownerPhone } });
  if (existing) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }
  // Unknown location ids fail the whole create — the form only offers
  // real rows, so a bad id means a stale tab, not a typo to forgive.
  const uniqueLocationIds = Array.from(new Set(body.locationIds));
  if (uniqueLocationIds.length > 0) {
    const found = await db.serviceLocation.count({ where: { id: { in: uniqueLocationIds } } });
    if (found !== uniqueLocationIds.length) {
      return NextResponse.json({ error: "invalid_locations" }, { status: 400 });
    }
  }
  const base = slugifyName(body.name);
  let slug = base;
  let attempt = 2;
  while (await db.nursery.findUnique({ where: { slug: slug } })) {
    slug = `${base}-${attempt}`;
    attempt += 1;
    if (attempt > 100) {
      slug = `${base}-${Date.now()}`;
      break;
    }
  }
  const growArea = body.growArea !== null && body.growArea.length > 0 ? body.growArea : null;
  const scopeKm = body.scope === "RADIUS" ? body.scopeKm : null;
  try {
    const created = await db.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: { phone: body.ownerPhone, name: body.ownerName, role: "SELLER" },
      });
      const nursery = await tx.nursery.create({
        data: {
          ownerId: owner.id,
          name: body.name,
          slug: slug,
          phone: body.phone,
          gstin: body.gstin.toUpperCase(),
          city: body.city,
          area: body.area,
          pincode: body.pincode,
          scope: body.scope,
          scopeKm: scopeKm,
          bulkOk: body.bulkOk,
          retailOk: body.retailOk,
          growArea: growArea,
        },
      });
      await tx.nurseryServiceArea.createMany({
        data: uniqueLocationIds.map((locationId) => ({
          nurseryId: nursery.id,
          locationId: locationId,
        })),
        skipDuplicates: true,
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: "nursery.create",
          entity: `Nursery:${nursery.id}`,
          meta: {
            name: nursery.name,
            slug: nursery.slug,
            city: nursery.city,
            ownerName: owner.name,
            ownerPhone: owner.phone,
            status: nursery.status,
            locationCount: uniqueLocationIds.length,
            source: "admin",
          },
        },
      });
      return { nursery: nursery, owner: owner };
    });
    return NextResponse.json({
      ok: true,
      nursery: { id: created.nursery.id, name: created.nursery.name, slug: created.nursery.slug },
    });
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    throw e;
  }
}