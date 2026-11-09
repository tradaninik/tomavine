import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PUBLIC_PRODUCT_INCLUDE, hiddenCategoryWhere, productCard, publicProductWhere } from "@/lib/catalog";

// `cat=<slug>` — a Category-tree slug (top OR sub). Resolved to
// node ids server-side: a top matches its whole subtree (its own
// products + every sub's), a sub matches just that sub. A legacy
// string fallback keeps products with categoryId NULL (created
// before/without the tree) on the right page: a TOP page takes every
// legacy product of its top key, a SUB page only those whose legacy
// subCategory string names that sub — so an unlinked legacy product
// no longer leaks onto every sibling sub page. Visibility rules
// (publicProductWhere) are unchanged.
async function applyCategorySlugFilter(where: Prisma.ProductWhereInput, catSlug: string): Promise<Prisma.ProductWhereInput | null> {
  const node = await db.category.findUnique({
    where: { slug: catSlug },
    include: {
      parent: { select: { id: true, legacyKey: true } },
      children: { select: { id: true } },
    },
  });
  if (!node || !node.active) {
    return null;
  }
  const ids = node.parentId === null ? [node.id, ...node.children.map((c) => c.id)] : [node.id];
  const topKey = node.parentId === null ? node.legacyKey : (node.parent?.legacyKey ?? null);
  const or: Prisma.ProductWhereInput[] = [{ categoryId: { in: ids } }];
  if (topKey) {
    if (node.parentId === null) {
      // Top page: every legacy product of this top key belongs here.
      or.push({ categoryId: null, category: topKey });
    } else {
      // Sub page: only the legacy products whose presentation
      // string names this exact sub.
      or.push({ categoryId: null, category: topKey, subCategory: node.slug });
    }
  }
  where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: or }];
  return where;
}

// T1C (spec docs/t1b-search-spec.md 3.2): pagination + price/stock
// filters, parsed in the route's existing lenient style - malformed
// values clamp or are ignored, never a 500. Whole-number strings
// only; anything else (negative, decimal, empty) is malformed.
function positiveInt(v: string | null): number | null {
  if (v === null || !/^\d+$/.test(v)) {
    return null;
  }
  return Number.parseInt(v, 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const catSlug = url.searchParams.get("cat");
  const sub = url.searchParams.get("sub");
  const nurserySlug = url.searchParams.get("nursery");
  const rescueOnly = url.searchParams.get("rescue");
  const q = url.searchParams.get("q");
  const idsParam = url.searchParams.get("ids");

  // T1C params (spec 3.2). size defaults to 100 = the legacy take,
  // so every existing caller (homepage, /bulk, the ?ids= lookups)
  // keeps its exact behavior without passing anything.
  const pageRaw = positiveInt(url.searchParams.get("page"));
  const page = pageRaw !== null && pageRaw >= 1 ? pageRaw : 1;
  const sizeRaw = positiveInt(url.searchParams.get("size"));
  const size = sizeRaw === null ? 100 : Math.min(100, Math.max(1, sizeRaw));
  const min = positiveInt(url.searchParams.get("min"));
  const max = positiveInt(url.searchParams.get("max"));
  const stockOnly = url.searchParams.get("stock") === "1";

  const where: Prisma.ProductWhereInput = publicProductWhere();

  if (catSlug) {
    const withCat = await applyCategorySlugFilter(where, catSlug);
    if (withCat === null) {
      // Unknown or inactive slug (spec 3.4): empty list, now with
      // the correct meta - same leniency as before.
      return NextResponse.json({ products: [], total: 0, page: page, size: size, pageCount: 0 });
    }
  }

  // Mission S6-B: parked (inactive) categories never appear in ANY
  // listing - the homepage grid, search, the advisor-driven picks
  // and the ids lookup the cart/checkout pages use (a parked product
  // sitting in a stale cart shows up as unavailable, which is exactly
  // the pivot behavior we want - it must be removed before checkout).
  const hidden = await hiddenCategoryWhere();
  if (hidden !== null) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), hidden];
  }

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

  // T1C filters (spec 3.2): min/max target Product.priceMin - the
  // number the tile displays via inr(); stock=1 keeps only stock > 0.
  // min > max is not an error - the pair simply matches nothing.
  if (min !== null || max !== null) {
    const priceFilter: { gte?: number; lte?: number } = {};
    if (min !== null) {
      priceFilter.gte = min;
    }
    if (max !== null) {
      priceFilter.lte = max;
    }
    where.priceMin = priceFilter;
  }
  if (stockOnly) {
    where.stock = { gt: 0 };
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
      return NextResponse.json({ products: [], total: 0, page: page, size: size, pageCount: 0 });
    }
    where.id = { in: ids };
  }

  // T1C (spec 3.3): total counts the FULL match (not just this
  // page); pageCount = ceil(total / size), 0 when total is 0 so the
  // pager hides cleanly. Order stays createdAt DESC; a page beyond
  // pageCount is HTTP 200 with an empty array (the client clamps).
  const total = await db.product.count({ where: where });
  const pageCount = total === 0 ? 0 : Math.ceil(total / size);

  const products = await db.product.findMany({
    where: where,
    include: PUBLIC_PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * size,
    take: size,
  });

  return NextResponse.json({
    products: products.map((p) => productCard(p)),
    total: total,
    page: page,
    size: size,
    pageCount: pageCount,
  });
}