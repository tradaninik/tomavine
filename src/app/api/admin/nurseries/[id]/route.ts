import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

const Body = z.object({ action: z.enum(["verify", "reject"]) });

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
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const nursery = await db.nursery.findUnique({ where: { id: id } });
  if (!nursery) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const action = parsed.data.action;
  const newStatus = action === "verify" ? "VERIFIED" : "REJECTED";
  const updated = await db.nursery.update({
    where: { id: id },
    data: {
      status: newStatus,
      physVerifiedAt: action === "verify" ? new Date() : nursery.physVerifiedAt,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: adminId,
      action: action === "verify" ? "nursery.verify" : "nursery.reject",
      entity: `Nursery:${nursery.id}`,
      meta: {
        name: nursery.name,
        slug: nursery.slug,
        city: nursery.city,
        from: nursery.status,
        to: newStatus,
      },
    },
  });
  return NextResponse.json({ ok: true, status: updated.status });
}