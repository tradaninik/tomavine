import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminScope } from "@/lib/permissions";

export async function GET() {
  const gate = await requireAdminScope("audit");
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const logs = await db.auditLog.findMany({
    orderBy: { at: "desc" },
    take: 50,
    include: { actor: { select: { name: true, phone: true, role: true } } },
  });
  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      meta: l.meta,
      at: l.at.toISOString(),
      actorName: l.actor.name,
      actorPhone: l.actor.phone,
      actorRole: l.actor.role,
    })),
  });
}