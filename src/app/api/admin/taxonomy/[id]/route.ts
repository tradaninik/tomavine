import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

// ─────────────────────────────────────────────────────────────
// Admin taxonomy console — single-term API.
//
// PATCH → edit one term: label / names / groupName / note /
//         meta / sort / active. The optional fields (names,
//         groupName, note, meta) accept null to CLEAR them.
//         kind is deliberately not editable — it is set at
//         creation and is half of the (kind, label) identity.
//
// There is deliberately NO DELETE. The lazy seeder counts rows
// per kind, so a deleted seed term would simply resurrect on
// the next cold start — deactivating (active: false) is the
// honest way to retire a term: it vanishes from the public
// catalog and seller pickers while history stays intact.
// ─────────────────────────────────────────────────────────────

const PatchBody = z.object({
  label: z.string().trim().min(2).max(100).optional(),
  names: z.record(z.string(), z.string().trim().min(1).max(120)).nullable().optional(),
  groupName: z.string().trim().min(1).max(80).nullable().optional(),
  note: z.string().trim().min(1).max(500).nullable().optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable().optional(),
  sort: z.number().int().min(0).max(100000).optional(),
  active: z.boolean().optional(),
});

// Prisma refuses plain `null` for a JSON column on update — the
// DbNull sentinel means "store SQL NULL", which is exactly how
// the seeder stores terms that have no names/meta.
function jsonUpdate(value: Record<string, string | number | boolean> | null) {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || String(session.payload.role) !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = session.payload.sub;
  if (!adminId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { label, names, groupName, note, meta, sort, active } = parsed.data;
  const changed = Object.keys(parsed.data);
  if (changed.length === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const term = await db.taxonomyTerm.findUnique({ where: { id } });
  if (!term) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Renaming is allowed, but the (kind, label) identity must
  // stay unique — check for a clash first, then let the unique
  // constraint catch any race.
  if (label !== undefined && label !== term.label) {
    const clash = await db.taxonomyTerm.findFirst({
      where: { kind: term.kind, label, id: { not: id } },
    });
    if (clash) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
  }
  try {
    const updated = await db.taxonomyTerm.update({
      where: { id },
      data: {
        label,
        names: names === undefined ? undefined : jsonUpdate(names),
        groupName,
        note,
        meta: meta === undefined ? undefined : jsonUpdate(meta),
        sort,
        active,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: adminId,
        action: "taxonomy.update",
        entity: `TaxonomyTerm:${term.id}`,
        meta: {
          kind: term.kind,
          label: updated.label,
          fields: changed.join(","),
          renamedFrom: label !== undefined && label !== term.label ? term.label : null,
        },
      },
    });
    return NextResponse.json({ ok: true, term: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw e;
  }
}