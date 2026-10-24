import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// Admin plant-catalog console — single-product API (mission F).
//
// PATCH edits the fields the console exposes: name, price, MRP,
// stock, hidden, category remap (SUB node of the tree, legacy
// string re-derived), and nursery transfer. Photo uploads stay in
// the seller console. Every save is audit-logged as product.update
// with the list of changed keys.
// ─────────────────────────────────────────────────────────────

const PatchBody = z.object({
  nameEn: z.string().trim().min(2).max(120).optional(),
  priceMin: z.number().int().min(1).optional(),
  mrp: z.number().int().min(1).optional(),
  stock: z.number().int().min(0).max(9999).optional(),
  hidden: z.boolean().optional(),
  categoryId: z.string().trim().min(1).optional(),
  nurseryId: z.string().trim().min(1).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminScope("taxonomy");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const body = parsed.data;

  const product = await db.product.findUnique({ where: { id: id } });
  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const changed: string[] = [];
  const data: {
    nameEn?: string;
    priceMin?: number;
    mrp?: number;
    stock?: number;
    hidden?: boolean;
    categoryId?: string;
    category?: string;
    nurseryId?: string;
  } = {};

  if (body.nameEn !== undefined && body.nameEn !== product.nameEn) {
    data.nameEn = body.nameEn;
    changed.push("name");
  }
  if (body.priceMin !== undefined && body.priceMin !== product.priceMin) {
    data.priceMin = body.priceMin;
    changed.push("price");
  }
  if (body.mrp !== undefined && body.mrp !== product.mrp) {
    data.mrp = body.mrp;
    changed.push("mrp");
  }
  if (body.stock !== undefined && body.stock !== product.stock) {
    data.stock = body.stock;
    changed.push("stock");
  }
  if (body.hidden !== undefined && body.hidden !== product.hidden) {
    data.hidden = body.hidden;
    changed.push("hidden");
  }

  let categoryPath = "";
  if (body.categoryId !== undefined && body.categoryId !== product.categoryId) {
    const node = await db.category.findUnique({
      where: { id: body.categoryId },
      include: { parent: true },
    });
    if (!node || !node.active || !node.parent || !node.parent.active) {
      return NextResponse.json({ error: "bad_category" }, { status: 400 });
    }
    data.categoryId = node.id;
    data.category = node.parent.legacyKey ?? node.parent.slug;
    categoryPath = `${node.parent.slug}/${node.slug}`;
    changed.push("category");
  }

  if (body.nurseryId !== undefined && body.nurseryId !== product.nurseryId) {
    const nursery = await db.nursery.findUnique({ where: { id: body.nurseryId } });
    if (!nursery) {
      return NextResponse.json({ error: "bad_nursery" }, { status: 400 });
    }
    data.nurseryId = nursery.id;
    changed.push("nursery");
  }

  const finalPrice = data.priceMin ?? product.priceMin;
  const finalMrp = data.mrp ?? product.mrp;
  if (finalPrice > finalMrp) {
    return NextResponse.json({ error: "price_above_mrp" }, { status: 400 });
  }

  if (changed.length === 0) {
    return NextResponse.json({ ok: true, changed: [] });
  }

  await db.$transaction([
    db.product.update({ where: { id: id }, data: data }),
    db.auditLog.create({
      data: {
        actorId: adminId,
        action: "product.update",
        entity: `Product:${id}`,
        meta: {
          name: data.nameEn ?? product.nameEn,
          changed: changed.join(", "),
          category: categoryPath === "" ? undefined : categoryPath,
          source: "admin",
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, changed: changed });
}
