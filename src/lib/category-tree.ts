// ─────────────────────────────────────────────────────────────
// Client-side shape of GET /api/catalog/categories + slug
// resolution helpers for the /shop/c/[slug] browse page (2c).
// The page fetches the whole ACTIVE tree once and resolves
// top-vs-sub, siblings and subtree locally — no per-node
// endpoints. Pure TS: no "use client", no db.
// ─────────────────────────────────────────────────────────────

export type CategoryNode = {
  id: string;
  slug: string;
  names: Record<string, string> | null;
  emoji: string | null;
  sortOrder: number;
};

export type CategoryTop = CategoryNode & {
  gstRate: number | null;
  legacyKey: string | null;
  subs: CategoryNode[];
};

export type CategoryTree = CategoryTop[];

export type ResolvedCategory =
  | { kind: "top"; top: CategoryTop; sub: null }
  | { kind: "sub"; top: CategoryTop; sub: CategoryNode };

// slug → node + its top + siblings, or null for an unknown slug.
// The active tree is globally slug-unique (seeded + admin-enforced).
export function resolveSlug(tree: CategoryTree, slug: string): ResolvedCategory | null {
  for (const top of tree) {
    if (top.slug === slug) {
      return { kind: "top", top: top, sub: null };
    }
    const sub = top.subs.find((s) => s.slug === slug);
    if (sub) {
      return { kind: "sub", top: top, sub: sub };
    }
  }
  return null;
}

// Home tile photos: the 5 legacy tops keep their curated photos;
// newer tops reuse the terrace hero until real photos exist
// (no new image files in this mission).
const PHOTO_BY_SLUG: Record<string, string> = {
  plants: "/photos/cat-plants.jpg",
  saplings: "/photos/cat-saplings.jpg",
  inputs: "/photos/cat-inputs.jpg",
  pots: "/photos/cat-pots.jpg",
  tools: "/photos/cat-tools.jpg",
};

export function topPhoto(slug: string): string {
  return PHOTO_BY_SLUG[slug] ?? "/photos/hero-terrace.jpg";
}
