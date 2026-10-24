import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// Admin plant-catalog console — collection API (mission F).
//
// The super admin's answer to "I can disable categories but can't
// add any plants": list EVERY product across nurseries, and create
// new ones on behalf of any nursery with proper mapping onto the
// two-level Category tree (Product.categoryId at SUB level, plus
// the legacy Product.category string derived from the top's
// legacyKey — or its slug for the six tops that have no legacy
// twin — so the storefront keeps working until the 2c flip).
//
// Scope: "taxonomy" (the catalog scope — Categories, Taxonomy and
// Plants all live under it).
// ─────────────────────────────────────────────────────────────

function labelOf(node: { slug: string; names: unknown } | null | undefined): string {
  if (!node) {
    return "";
  }
  const names = node.names;
  if (names && typeof names === "object" && !Array.isArray(names)) {
    const en = (names as Record<string, unknown>).en;
    if (typeof en === "string" && en.length > 0) {
      return en;
    }
  }
  return node.slug;
}

export async function GET() {
  const gate = await requireAdminScope("taxonomy");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [rows, nurseries, hiddenCount, unmappedCount] = await Promise.all([
    db.product.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      include: {
        nursery: { select: { id: true, name: true, status: true } },
        categoryNode: { select: { slug: true, names: true, emoji: true, parent: { select: { slug: true, names: true, emoji: true, legacyKey: true } } } },
      },
    }),
    db.nursery.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    db.product.count({ where: { hidden: true } }),
    db.product.count({ where: { categoryId: null } }),
  ]);

  return NextResponse.json({
    products: rows.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      botanical: p.botanical,
      priceMin: p.priceMin,
      mrp: p.mrp,
      stock: p.stock,
      hidden: p.hidden,
      image: p.image,
      createdAt: p.createdAt.toISOString(),
      nurseryId: p.nurseryId,
      nurseryName: p.nursery.name,
      nurseryStatus: p.nursery.status,
      categoryId: p.categoryId,
      category: p.category,
      top: p.categoryNode && p.categoryNode.parent
        ? { slug: p.categoryNode.parent.slug, label: labelOf(p.categoryNode.parent), emoji: p.categoryNode.parent.emoji }
        : null,
      sub: p.categoryNode
        ? { slug: p.categoryNode.slug, label: labelOf(p.categoryNode), emoji: p.categoryNode.emoji }
        : null,
    })),
    nurseries,
    summary: { total: rows.length, hidden: hiddenCount, unmapped: unmappedCount },
  });
}

const CreateBody = z.object({
  nurseryId: z.string().trim().min(1),
  categoryId: z.string().trim().min(1),
  nameEn: z.string().trim().min(2).max(120),
  botanical: z.string().trim().max(120).optional().default(""),
  priceMin: z.number().int().min(1),
  mrp: z.number().int().min(1),
  stock: z.number().int().min(0).max(9999).optional().default(0),
});

export async function POST(req: Request) {
  const gate = await requireAdminScope("taxonomy");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const body = parsed.data;
  if (body.priceMin > body.mrp) {
    return NextResponse.json({ error: "price_above_mrp" }, { status: 400 });
  }

  // The chosen node must be an ACTIVE SUB — the form offers exactly
  // those, so anything else means a stale tab.
  const node = await db.category.findUnique({
    where: { id: body.categoryId },
    include: { parent: true },
  });
  if (!node || !node.active || !node.parent || !node.parent.active) {
    return NextResponse.json({ error: "bad_category" }, { status: 400 });
  }

  const nursery = await db.nursery.findUnique({ where: { id: body.nurseryId } });
  if (!nursery) {
    return NextResponse.json({ error: "bad_nursery" }, { status: 400 });
  }

  // Legacy compatibility string: the top's legacyKey when it has one
  // (plants/saplings/inputs/pots/tools), otherwise the top's slug —
  // the storefront keeps rendering, and checkout taxes come from the
  // category node's GST, not this string.
  const legacyCategory = node.parent.legacyKey ?? node.parent.slug;

  const product = await db.product.create({
    data: {
      nurseryId: nursery.id,
      categoryId: node.id,
      category: legacyCategory,
      nameEn: body.nameEn,
      botanical: body.botanical === "" ? undefined : body.botanical,
      priceMin: body.priceMin,
      mrp: body.mrp,
      stock: body.stock,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: adminId,
      action: "product.create",
      entity: `Product:${product.id}`,
      meta: {
        name: product.nameEn,
        nursery: nursery.name,
        category: `${node.parent.slug}/${node.slug}`,
        price: product.priceMin,
        stock: product.stock,
        source: "admin",
      },
    },
  });

  return NextResponse.json({ ok: true, productId: product.id });
}
