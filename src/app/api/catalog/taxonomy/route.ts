import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureTaxonomySeeded, isTaxonomyKind, KIND_META, TAXONOMY_KINDS } from "@/lib/taxonomy";

// GET /api/catalog/taxonomy            → every active term, all kinds
// GET /api/catalog/taxonomy?kind=soil  → active terms of one kind only
// Public read API — this is what seller pick-lists will fetch.
// The first call lazily seeds the default catalog.
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");

  const where: { active: boolean; kind?: string } = { active: true };
  if (kind !== null && isTaxonomyKind(kind)) {
    where.kind = kind;
  }

  try {
    await ensureTaxonomySeeded();
  } catch (e) {
    console.warn("[taxonomy] seed check failed — will retry on next call:", e);
  }

  try {
    const terms = await db.taxonomyTerm.findMany({
      where: where,
      orderBy: [{ kind: "asc" }, { sort: "asc" }, { label: "asc" }],
    });
    const kinds = TAXONOMY_KINDS.map((code) => ({
      code: code,
      label: KIND_META[code].label,
      emoji: KIND_META[code].emoji,
      blurb: KIND_META[code].blurb,
      groups: KIND_META[code].groups,
    }));
    return NextResponse.json({ terms: terms, kinds: kinds });
  } catch (e) {
    console.warn("[taxonomy] read failed:", e);
    return NextResponse.json({ error: "db_unavailable" }, { status: 500 });
  }
}