import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

export async function GET() {
  const session = await getSession();
  if (!session || String(session.payload.role) !== "ADMIN") {
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