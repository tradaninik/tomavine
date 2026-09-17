import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PUBLIC_PRODUCT_INCLUDE, productCard, publicProductWhere } from "@/lib/catalog";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const nursery = await db.nursery.findFirst({
    where: { slug: slug, status: "VERIFIED" },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      area: true,
      pincode: true,
      scope: true,
      scopeKm: true,
      ratingAvg: true,
      retailOk: true,
      bulkOk: true,
      physVerifiedAt: true,
    },
  });

  if (!nursery) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const products = await db.product.findMany({
    where: { ...publicProductWhere(), nurseryId: nursery.id },
    include: PUBLIC_PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    nursery: nursery,
    products: products.map((p) => productCard(p)),
  });
}