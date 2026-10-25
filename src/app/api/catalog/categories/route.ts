import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/catalog/categories — the full ACTIVE browse tree.
// Tops (parentId null) with their nested subs, both ordered by
// sortOrder. This is a single public read; /shop/c/[slug] fetches
// it once and resolves top-vs-sub, siblings and subtree
// client-side, so there is no per-node resolve endpoint.
//
// tops carry: id, slug, names (6-lang), emoji, gstRate (percent or
// null = inherit), legacyKey (only the 5 legacy tops), sortOrder.
// subs carry: id, slug, names, emoji, sortOrder.
export async function GET() {
  try {
    const rows = await db.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      select: {
        id: true,
        slug: true,
        parentId: true,
        names: true,
        emoji: true,
        gstRate: true,
        legacyKey: true,
        sortOrder: true,
      },
    });

    const byParent = new Map<string, typeof rows>();
    for (const row of rows) {
      if (row.parentId === null) {
        continue;
      }
      const list = byParent.get(row.parentId) ?? [];
      list.push(row);
      byParent.set(row.parentId, list);
    }

    const tops = rows
      .filter((row) => row.parentId === null)
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        names: row.names as Record<string, string> | null,
        emoji: row.emoji,
        gstRate: row.gstRate,
        legacyKey: row.legacyKey,
        sortOrder: row.sortOrder,
        subs: (byParent.get(row.id) ?? []).map((sub) => ({
          id: sub.id,
          slug: sub.slug,
          names: sub.names as Record<string, string> | null,
          emoji: sub.emoji,
          sortOrder: sub.sortOrder,
        })),
      }));

    return NextResponse.json({ categories: tops });
  } catch (e) {
    console.warn("[categories] read failed:", e);
    return NextResponse.json({ error: "db_unavailable" }, { status: 500 });
  }
}
