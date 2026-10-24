import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";
import { TAXONOMY_KINDS, KIND_META } from "@/lib/taxonomy";

// ─────────────────────────────────────────────────────────────
// Admin category-tree console — collection API (mission X).
//
// The two-level Category tree (phase 2a, 56 seeded rows) is the
// browse structure the storefront flips to in phase 2c. This API
// is how the owner curates it: rename, translate, re-order,
// re-parent, retire, and add nodes — until the flip, nothing on
// the storefront reads it, so edits are safe to make live.
//
// GET  → every category (active AND inactive) plus:
//        counts   → { categoryId: productCount } for attached
//                   products (the backfill mapped all 12)
//        unmapped → products still carrying categoryId null
//        taxonomy → per-kind term totals (active/total) so the
//                   console's insights block can cross-link the
//                   attribute types without a second roundtrip
//
// POST → create a top or a sub. Rules:
//        • names.en is required identity for display; regional
//          names are optional and always full-replace
//        • slug: optional kebab-case identity, auto-derived from
//          the English name when omitted — unique, locked after
//        • parentId must be a TOP-level category (2 levels max)
//        • gstRate null = inherit (subs) / platform default (tops)
//        • sortOrder defaults to tail of its sibling group
//
// Scope: "taxonomy" — categories ARE catalog taxonomy; no new
// scope was added, so existing admin grants need no migration.
// ─────────────────────────────────────────────────────────────

const LANG_KEYS = ["en", "hi", "te", "kn", "ta", "mr"] as const;

const NamesSchema = z
  .record(z.string(), z.string().trim().min(1).max(120))
  .superRefine((names, ctx) => {
    const keys = Object.keys(names);
    for (const k of keys) {
      if (!(LANG_KEYS as readonly string[]).includes(k)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `bad language key: ${k}` });
      }
    }
    if (!names.en || names.en.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "names.en is required" });
    }
  });

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CreateBody = z.object({
  slug: z.string().trim().min(2).max(80).regex(SLUG_RE).optional(),
  names: NamesSchema,
  emoji: z.string().trim().min(1).max(16).optional(),
  gstRate: z.number().int().min(0).max(28).nullable().optional(),
  parentId: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

// "Indoor Plants" → "indoor-plants". Non-ASCII (regional names)
// falls away, so slugs stay URL-safe English.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET() {
  const gate = await requireAdminScope("taxonomy");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const [categories, grouped, unmapped, kindRows] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
    db.product.groupBy({
      by: ["categoryId"],
      where: { categoryId: { not: null } },
      _count: { _all: true },
    }),
    db.product.count({ where: { categoryId: null } }),
    db.taxonomyTerm.groupBy({ by: ["kind", "active"], _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = {};
  for (const g of grouped) {
    if (g.categoryId) {
      counts[g.categoryId] = g._count._all;
    }
  }
  const taxonomy = TAXONOMY_KINDS.map((code) => {
    const rows = kindRows.filter((r) => r.kind === code);
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    const active = rows.filter((r) => r.active).reduce((sum, r) => sum + r._count._all, 0);
    return { code, label: KIND_META[code].label, emoji: KIND_META[code].emoji, total, active };
  });
  return NextResponse.json({ categories, counts, unmapped, taxonomy });
}

export async function POST(req: Request) {
  const gate = await requireAdminScope("taxonomy");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { slug, names, emoji, gstRate, parentId, sortOrder } = parsed.data;

  // Parent, when given, must be an existing TOP-level node — the
  // tree is exactly two levels deep, so a sub can never parent one.
  let parent = null;
  if (parentId !== undefined) {
    parent = await db.category.findUnique({ where: { id: parentId } });
    if (!parent || parent.parentId !== null) {
      return NextResponse.json({ error: "bad_parent" }, { status: 400 });
    }
  }

  const finalSlug = (slug ?? slugify(names.en)).toLowerCase();
  if (!SLUG_RE.test(finalSlug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  const clash = await db.category.findUnique({ where: { slug: finalSlug } });
  if (clash) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }

  // Append after the tail of the sibling group (tops or this
  // parent's subs) so a new node never jumps the queue.
  const last = await db.category.findFirst({
    where: { parentId: parent ? parent.id : null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sort = sortOrder ?? (last?.sortOrder ?? -1) + 1;

  try {
    const category = await db.category.create({
      data: {
        slug: finalSlug,
        names: names as Prisma.InputJsonValue,
        emoji,
        gstRate: gstRate ?? null,
        parentId: parent ? parent.id : null,
        sortOrder: sort,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: adminId,
        action: "category.create",
        entity: `Category:${category.id}`,
        meta: {
          slug: finalSlug,
          en: names.en,
          parentSlug: parent ? parent.slug : null,
        },
      },
    });
    return NextResponse.json({ ok: true, category });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    throw e;
  }
}
