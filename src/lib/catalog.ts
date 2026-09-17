import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Shared server-side helpers for the public catalog APIs.
// Public rules (mirroring /api/orders checkout-time checks):
//   - hidden products are never listed
//   - only nurseries with status VERIFIED and retailOk true
//   - expired rescue listings are dropped (rescue becomes null)
// The ProductCard shape structurally matches CartProduct in
// src/lib/cart.ts, so the cart page can reuse this response.
// ─────────────────────────────────────────────────────────────

export type ProductVariantCard = {
  id: string;
  label: string;
  price: number;
};

export type ProductCard = {
  id: string;
  nameEn: string;
  names: Record<string, string> | null;
  category: string;
  botanical: string | null;
  priceMin: number;
  mrp: number;
  stock: number;
  nurseryId: string;
  nurseryName: string;
  nurserySlug: string;
  nurseryCity: string;
  variants: ProductVariantCard[];
  rescue: { pct: number; expiresAt: string } | null;
  avgStars: number;
  reviewCount: number;
};

export const PUBLIC_PRODUCT_INCLUDE = {
  variants: { select: { id: true, label: true, price: true } },
  rescue: { select: { pct: true, expiresAt: true } },
  nursery: { select: { id: true, name: true, slug: true, city: true } },
  reviews: { select: { stars: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof PUBLIC_PRODUCT_INCLUDE }>;

export function publicProductWhere(): Prisma.ProductWhereInput {
  return {
    hidden: false,
    nursery: { status: "VERIFIED", retailOk: true },
  };
}

export function productCard(p: ProductWithRelations): ProductCard {
  const now = Date.now();
  const rescue: { pct: number; expiresAt: string } | null =
    p.rescue && p.rescue.expiresAt.getTime() > now
      ? { pct: p.rescue.pct, expiresAt: p.rescue.expiresAt.toISOString() }
      : null;
  const starTotal = p.reviews.reduce((sum, r) => sum + r.stars, 0);
  const reviewCount = p.reviews.length;
  const avgStars = reviewCount > 0 ? Math.round((starTotal / reviewCount) * 10) / 10 : 0;
  return {
    id: p.id,
    nameEn: p.nameEn,
    names: p.names as Record<string, string> | null,
    category: p.category,
    botanical: p.botanical,
    priceMin: p.priceMin,
    mrp: p.mrp,
    stock: p.stock,
    nurseryId: p.nurseryId,
    nurseryName: p.nursery.name,
    nurserySlug: p.nursery.slug,
    nurseryCity: p.nursery.city,
    variants: p.variants.map((v) => ({ id: v.id, label: v.label, price: v.price })),
    rescue: rescue,
    avgStars: avgStars,
    reviewCount: reviewCount,
  };
}