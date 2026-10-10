import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const product = await db.product.findFirst({
    where: { id: id, hidden: false, nursery: { status: "VERIFIED", retailOk: true } },
    include: {
      variants: { select: { id: true, label: true, price: true } },
      rescue: { select: { pct: true, expiresAt: true } },
      nursery: {
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
          bulkOk: true,
          retailOk: true,
          physVerifiedAt: true,
        },
      },
      reviews: {
        select: { id: true, stars: true, text: true, reply: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const now = Date.now();
  const rescue =
    product.rescue && product.rescue.expiresAt.getTime() > now
      ? { pct: product.rescue.pct, expiresAt: product.rescue.expiresAt.toISOString() }
      : null;
  const starTotal = product.reviews.reduce((sum, r) => sum + r.stars, 0);
  const avgStars = product.reviews.length > 0 ? Math.round((starTotal / product.reviews.length) * 10) / 10 : 0;

  return NextResponse.json({
    product: {
      id: product.id,
      nameEn: product.nameEn,
      names: product.names,
      category: product.category,
      botanical: product.botanical,
      badges: product.badges,
      care: product.care,
      agri: product.agri,
      provenance: product.provenance,
      priceMin: product.priceMin,
      mrp: product.mrp,
      stock: product.stock,
      subCategory: product.subCategory,
      image: product.image,
      nursery: product.nursery,
      variants: product.variants.map((v) => ({ id: v.id, label: v.label, price: v.price })),
      rescue: rescue,
      reviews: product.reviews.map((r) => ({
        id: r.id,
        stars: r.stars,
        text: r.text,
        reply: r.reply,
        createdAt: r.createdAt.toISOString(),
        reviewer: r.user.name ?? "Tomavine customer",
      })),
      avgStars: avgStars,
      reviewCount: product.reviews.length,
    },
  });
}