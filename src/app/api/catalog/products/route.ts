import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PUBLIC_PRODUCT_INCLUDE, productCard, publicProductWhere } from "@/lib/catalog";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const sub = url.searchParams.get("sub");
  const nurserySlug = url.searchParams.get("nursery");
  const rescueOnly = url.searchParams.get("rescue");
  const q = url.searchParams.get("q");
  const idsParam = url.searchParams.get("ids");

  const where: Prisma.ProductWhereInput = publicProductWhere();

  if (category) {
    where.category = category;
  }

  if (sub) {
    where.subCategory = sub;
  }
  if (nurserySlug) {
    where.nursery = { status: "VERIFIED", retailOk: true, slug: nurserySlug };
  }

  if (rescueOnly === "1") {
    where.rescue = { expiresAt: { gt: new Date() } };
  }

  if (q) {
    where.OR = [
      { nameEn: { contains: q, mode: "insensitive" } },
      { botanical: { contains: q, mode: "insensitive" } },
    ];
  }

  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 50);
    if (ids.length === 0) {
      return NextResponse.json({ products: [] });
    }
    where.id = { in: ids };
  }

  const products = await db.product.findMany({
    where: where,
    include: PUBLIC_PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ products: products.map((p) => productCard(p)) });
}