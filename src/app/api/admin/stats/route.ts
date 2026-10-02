import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, scopeAllows } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// Admin overview stats — scope-aware.
//
// Any ADMIN may open the overview, but each section is served
// only to admins who hold the matching scope:
//   nurseries cards + pending-verification banner → "nurseries"
//   orders stat + order pipeline                   → "orders"
//   delivered revenue                              → "orders" OR "accounting"
//   users & leads breakdown                        → SUPER_ADMIN only
// Sections the caller may not see come back as null and the
// overview page hides them. scopeAllows is the same pure rule
// every /api/admin/* scope gate uses, evaluated against
// permissions read fresh from the database here — so a scope
// change reflects on the next overview load, no relogin needed.
// ─────────────────────────────────────────────────────────────

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const me = await db.user.findUnique({
    where: { id: gate.adminId },
    select: { role: true, permissions: true },
  });
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const role = String(me.role);
  const perms: unknown = me.permissions;
  const isSuper = role === "SUPER_ADMIN";
  const showNurseries = scopeAllows(role, perms, "nurseries");
  const showOrders = scopeAllows(role, perms, "orders");
  const showRevenue = showOrders || scopeAllows(role, perms, "accounting");

  const [nurseries, orders, users, leads, revenue] = await Promise.all([
    showNurseries ? db.nursery.groupBy({ by: ["status"], _count: { _all: true } }) : null,
    showOrders ? db.order.groupBy({ by: ["status"], _count: { _all: true } }) : null,
    isSuper ? db.user.groupBy({ by: ["role"], _count: { _all: true } }) : null,
    isSuper ? db.bulkLead.groupBy({ by: ["status"], _count: { _all: true } }) : null,
    showRevenue ? db.order.aggregate({ where: { status: "DELIVERED" }, _sum: { total: true } }) : null,
  ]);

  return NextResponse.json({
    nurseries: nurseries === null ? null : nurseries.map((n) => ({ status: n.status, count: n._count._all })),
    orders: orders === null ? null : orders.map((o) => ({ status: o.status, count: o._count._all })),
    users: users === null ? null : users.map((u) => ({ role: u.role, count: u._count._all })),
    leads: leads === null ? null : leads.map((l) => ({ status: l.status, count: l._count._all })),
    revenueDelivered: revenue === null ? null : (revenue._sum.total ?? 0),
  });
}