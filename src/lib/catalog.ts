import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rateFromNodeChain } from "@/lib/category-gst";

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
  care: Record<string, string> | null;
  priceMin: number;
  mrp: number;
  stock: number;
  subCategory: string | null;
  image: string | null;
  nurseryId: string;
  nurseryName: string;
  nurserySlug: string;
  nurseryCity: string;
  // Mission F: the nursery's franchise switches (raw JSON — read with
  // readNurseryFeatures). Checkout uses cod/online to grey out payment
  // options when ANY nursery in the cart disallows one. Not secret
  // config — it is exactly what the storefront must respect.
  nurseryFeatures: unknown;
  variants: ProductVariantCard[];
  // Mission S6-B: minimum order quantity for bulk listings; null or
  // 1 means "no minimum beyond the usual one". Carried on every
  // ProductCard so cart/checkout can enforce it client-side.
  moq: number | null;
  rescue: { pct: number; expiresAt: string } | null;
  avgStars: number;
  reviewCount: number;
  // Resolved GST whole percent from the category tree (node, else
  // parent top, 5 floor when mapped — mirrors Mission F's server
  // charge in api/orders; null = unmapped → the client falls back
  // to the legacy string rule — see lib/category-gst.ts).
  gstRate: number | null;
};

export const PUBLIC_PRODUCT_INCLUDE = {
  variants: { select: { id: true, label: true, price: true } },
  rescue: { select: { pct: true, expiresAt: true } },
  nursery: { select: { id: true, name: true, slug: true, city: true, features: true } },
  reviews: { select: { stars: true } },
  categoryNode: { select: { gstRate: true, parent: { select: { gstRate: true } } } },
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
    care:
      p.care !== null && typeof p.care === "object" && !Array.isArray(p.care)
        ? (p.care as Record<string, string>)
        : null,
    priceMin: p.priceMin,
    mrp: p.mrp,
    stock: p.stock,
    subCategory: p.subCategory,
    image: p.image,
    nurseryId: p.nurseryId,
    nurseryName: p.nursery.name,
    nurserySlug: p.nursery.slug,
    nurseryCity: p.nursery.city,
    nurseryFeatures: p.nursery.features,
    variants: p.variants.map((v) => ({ id: v.id, label: v.label, price: v.price })),
    moq: p.moq,
    rescue: rescue,
    avgStars: avgStars,
    reviewCount: reviewCount,
    gstRate: rateFromNodeChain(p.categoryNode),
  };
}

// -------------------------------------------------------------
// Mission S6-B: bulk-first pivot. Categories the owner parked
// (active = false - ornamental plants, decor, gifts and the retail
// pot subs) disappear from every UNFILTERED product listing: the
// homepage grid, search, the advisor and the RFQ product picker.
// Resolution mirrors applyCategorySlugFilter: a product belongs to
// a parked category when its categoryId sits anywhere in that
// top's subtree, OR (legacy rows with categoryId null) when its
// category string equals the parked top's legacyKey. Returns null
// when nothing is parked, so the common case adds no WHERE clause.
// Direct product links (/shop/product/<id>) keep working on
// purpose - old WhatsApp links must not break; parked items just
// stop being LISTED.
// -------------------------------------------------------------
export async function hiddenCategoryWhere(): Promise<Prisma.ProductWhereInput | null> {
  const parked = await db.category.findMany({
    where: { active: false },
    select: { id: true, parentId: true, legacyKey: true, children: { select: { id: true } } },
  });
  if (parked.length === 0) {
    return null;
  }
  const ids: string[] = [];
  const legacyKeys: string[] = [];
  for (const row of parked) {
    ids.push(row.id, ...row.children.map((c) => c.id));
    if (row.parentId === null && row.legacyKey !== null) {
      legacyKeys.push(row.legacyKey);
    }
  }
  const and: Prisma.ProductWhereInput[] = [{ categoryId: { notIn: ids } }];
  if (legacyKeys.length > 0) {
    and.push({ category: { notIn: legacyKeys } });
  }
  return { AND: and };
}