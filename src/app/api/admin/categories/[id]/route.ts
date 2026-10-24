import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// Admin category-tree console — single-node API (mission X).
//
// PATCH → edit one category:
//   names     full replace (en required, regional optional)
//   emoji     string or null to clear
//   gstRate   0–28 or null (null = inherit parent / default)
//   sortOrder manual position within its sibling group
//   active    deactivate / reactivate (no delete anywhere —
//             retiring keeps history and product links intact)
//   parentId  MOVE the node: null promotes to top, an id moves
//             a sub under a different top. Blocked when the move
//             would create a 3rd level (node has children) or the
//             target is not a top.
//
// slug and legacyKey are deliberately NOT editable: slug is the
// URL identity the storefront will route on (phase 2c), and
// legacyKey is the bridge from the old 5-category storefront —
// both are set once (seed or create) and stay frozen.
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

const PatchBody = z.object({
  names: NamesSchema.optional(),
  emoji: z.string().trim().min(1).max(16).nullable().optional(),
  gstRate: z.number().int().min(0).max(28).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  active: z.boolean().optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminScope("taxonomy");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { names, emoji, gstRate, sortOrder, active, parentId } = parsed.data;
  const changed = Object.keys(parsed.data);
  if (changed.length === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const category = await db.category.findUnique({ where: { id } });
  if (!category) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Move validation — only when parentId is actually changing.
  if (parentId !== undefined && parentId !== category.parentId) {
    if (parentId === null) {
      // Promote to top: always fine.
    } else {
      if (parentId === id) {
        return NextResponse.json({ error: "bad_parent" }, { status: 400 });
      }
      const target = await db.category.findUnique({ where: { id: parentId } });
      if (!target || target.parentId !== null) {
        return NextResponse.json({ error: "bad_parent" }, { status: 400 });
      }
    }
    // A node with children cannot become a sub — that would make
    // a 3-level tree the storefront flip cannot render.
    const childCount = await db.category.count({ where: { parentId: id } });
    if (childCount > 0 && parentId !== null) {
      return NextResponse.json({ error: "has_children" }, { status: 400 });
    }
  }

  try {
    const updated = await db.category.update({
      where: { id },
      data: {
        names: names === undefined ? undefined : (names as Prisma.InputJsonValue),
        emoji,
        gstRate,
        sortOrder,
        active,
        parentId: parentId === undefined ? undefined : parentId,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: adminId,
        action: "category.update",
        entity: `Category:${category.id}`,
        meta: {
          slug: updated.slug,
          fields: changed.join(","),
          renamedEnFrom:
            names !== undefined && names.en !== (category.names as Record<string, string> | null)?.en
              ? ((category.names as Record<string, string> | null)?.en ?? null)
              : null,
          movedToParent: parentId !== undefined && parentId !== category.parentId ? parentId : null,
        },
      },
    });
    return NextResponse.json({ ok: true, category: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw e;
  }
}
