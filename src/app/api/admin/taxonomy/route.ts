import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";
import { TAXONOMY_KINDS, KIND_META, isTaxonomyKind, ensureTaxonomySeeded } from "@/lib/taxonomy";

// ─────────────────────────────────────────────────────────────
// Admin taxonomy console — collection API.
//
// GET  → every term (active AND inactive) plus a kinds array
//        built from KIND_META, so the console page (a client
//        component) never imports the server-only taxonomy
//        module. Lazily seeds too — a fresh database fills
//        itself before the console can ever look empty.
//
// POST → create a term. Labels are the identity: (kind, label)
//        is unique — duplicates return 409. There is no hard
//        delete anywhere in the taxonomy; deactivation is a
//        PATCH on /api/admin/taxonomy/[id].
// ─────────────────────────────────────────────────────────────

const CreateBody = z.object({
  kind: z.string().refine(isTaxonomyKind),
  label: z.string().trim().min(2).max(100),
  names: z.record(z.string(), z.string().trim().min(1).max(120)).optional(),
  groupName: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function GET() {
  const gate = await requireAdminScope("taxonomy");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await ensureTaxonomySeeded();
  const terms = await db.taxonomyTerm.findMany({
    orderBy: [{ kind: "asc" }, { sort: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({
    terms,
    kinds: TAXONOMY_KINDS.map((code) => ({
      code,
      label: KIND_META[code].label,
      emoji: KIND_META[code].emoji,
      blurb: KIND_META[code].blurb,
      groups: KIND_META[code].groups,
    })),
  });
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
  const { kind, label, names, groupName, note, meta } = parsed.data;
  const existing = await db.taxonomyTerm.findFirst({ where: { kind, label } });
  if (existing) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }
  // Seed terms carry global sort indices, so a new term appends
  // after the current tail of its kind instead of jumping to the
  // top of every ordered list. PATCH can move it later.
  const last = await db.taxonomyTerm.findFirst({
    where: { kind },
    orderBy: { sort: "desc" },
    select: { sort: true },
  });
  const sort = (last?.sort ?? -1) + 1;
  try {
    const term = await db.taxonomyTerm.create({
      data: {
        kind,
        label,
        names: names === undefined ? undefined : (names as Prisma.InputJsonValue),
        groupName,
        note,
        meta: meta === undefined ? undefined : (meta as Prisma.InputJsonValue),
        sort,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: adminId,
        action: "taxonomy.create",
        entity: `TaxonomyTerm:${term.id}`,
        meta: {
          kind,
          label,
          groupName: groupName ?? null,
        },
      },
    });
    return NextResponse.json({ ok: true, term });
  } catch (e) {
    // Race-safe duplicate: two admins creating the same (kind,
    // label) at once — the loser hits the unique constraint.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    throw e;
  }
}