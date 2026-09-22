import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const [nurseries, orders, users, leads, revenue] = await Promise.all([
    db.nursery.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.bulkLead.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.aggregate({ where: { status: "DELIVERED" }, _sum: { total: true } }),
  ]);
  return NextResponse.json({
    nurseries: nurseries.map((n) => ({ status: n.status, count: n._count._all })),
    orders: orders.map((o) => ({ status: o.status, count: o._count._all })),
    users: users.map((u) => ({ role: u.role, count: u._count._all })),
    leads: leads.map((l) => ({ status: l.status, count: l._count._all })),
    revenueDelivered: revenue._sum.total ?? 0,
  });
}