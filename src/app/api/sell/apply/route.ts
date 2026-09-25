import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

const ApplyBody = z.object({
  ownerName: z.string().trim().min(2).max(80).optional(),
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
});

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "nursery";
}

// GET /api/sell/apply — the current visitor's listing state.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = String(session.payload.sub);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      phone: true,
      role: true,
      city: true,
      pincode: true,
      nursery: { select: { id: true, name: true, slug: true, status: true, city: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      name: user.name,
      phone: user.phone,
      role: user.role,
      city: user.city,
      pincode: user.pincode,
    },
    nursery: user.nursery,
  });
}

// POST /api/sell/apply — public self-serve onboarding:
// flips the applicant to SELLER and creates their PENDING nursery in one transaction.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = String(session.payload.sub);
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { nursery: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = String(user.role);
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (user.nursery) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }
  const parsed = ApplyBody.safeParse(await req.json().catch(() => null));
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
  const setName =
    body.ownerName !== undefined && (user.name === null || user.name.length === 0) ? body.ownerName : undefined;
  try {
    const created = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          role: "SELLER",
          ...(setName !== undefined ? { name: setName } : {}),
        },
      });
      const nursery = await tx.nursery.create({
        data: {
          ownerId: userId,
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
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "nursery.self_apply",
          entity: `Nursery:${nursery.id}`,
          meta: {
            name: nursery.name,
            slug: nursery.slug,
            city: nursery.city,
            ownerPhone: user.phone,
            status: nursery.status,
            source: "public",
          },
        },
      });
      return nursery;
    });
    return NextResponse.json({
      ok: true,
      nursery: { id: created.id, name: created.name, slug: created.slug },
    });
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    throw e;
  }
}