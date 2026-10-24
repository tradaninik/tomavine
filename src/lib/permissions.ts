import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

// ─────────────────────────────────────────────────────────────
// Admin permissions — Batch 4a foundation.
//
// Hierarchy: SUPER_ADMIN (founder) → ADMIN (staff) → SELLER → CUSTOMER.
//
// Scopes are the fine-grained surfaces an ADMIN may work in:
//   nurseries  → /admin/nurseries + /api/admin/nurseries*
//   orders     → /admin/orders   + /api/admin/orders
//   audit      → /admin/audit    + /api/admin/audit
//   taxonomy   → /admin/taxonomy + /api/admin/taxonomy*
//   accounting → reserved, no surface yet
//
// Rules:
//   • SUPER_ADMIN bypasses every scope check.
//   • ONLY SUPER_ADMIN can assign permissions — there is deliberately
//     no admin-grants-admin (an admin who can grant powers can grant
//     ALL powers; that hole stays closed).
//   • User.permissions is null until SUPER_ADMIN saves a list. null
//     means "never managed" → the admin keeps ALL scopes. That is what
//     lets the founder stay a fully working ADMIN across the whole
//     rollout. Once an explicit array is saved it is exact, and a
//     malformed value gets no scopes (fail closed).
//
// The gates below read role + permissions FRESH from the database on
// every call — the JWT can be up to 7 days stale, and revoking
// someone's access must take effect immediately, not at next login.
// ─────────────────────────────────────────────────────────────

export const ADMIN_SCOPES = ["nurseries", "orders", "audit", "taxonomy", "locations", "accounting"] as const;

export type AdminScope = (typeof ADMIN_SCOPES)[number];

export const SCOPE_META: Record<AdminScope, { label: string; hint: string }> = {
  nurseries: { label: "Nurseries", hint: "Verification queue and nursery records" },
  orders: { label: "Orders", hint: "Order oversight" },
  audit: { label: "Audit log", hint: "Audit trail feed" },
  taxonomy: { label: "Taxonomy", hint: "Catalog terms and the category tree" },
  locations: { label: "Locations", hint: "Serviceable-pincode list for the storefront dropdowns" },
  accounting: { label: "Accounting", hint: "Reserved — no surface yet" },
};

export function isAdminScope(value: unknown): value is AdminScope {
  return typeof value === "string" && (ADMIN_SCOPES as readonly string[]).includes(value);
}

export function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// Pure rule — no database. Used by the gates below and by
// /api/admin/users when saving an explicit scope list.
export function scopeAllows(role: string, permissions: unknown, scope: AdminScope): boolean {
  if (role === "SUPER_ADMIN") {
    return true;
  }
  if (role !== "ADMIN") {
    return false;
  }
  if (permissions === null || permissions === undefined) {
    return true; // never managed → grandfathered full access
  }
  if (Array.isArray(permissions)) {
    return permissions.some((s) => s === scope);
  }
  return false; // malformed value → fail closed
}

export type AdminGate =
  | { ok: true; adminId: string; role: "ADMIN" | "SUPER_ADMIN" }
  | { ok: false };

async function currentSub(): Promise<string | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const sub = session.payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    return null;
  }
  return sub;
}

async function loadAdminUser(sub: string): Promise<{ role: string; permissions: unknown } | null> {
  const user = await db.user.findUnique({
    where: { id: sub },
    select: { role: true, permissions: true },
  });
  if (!user) {
    return null;
  }
  return { role: String(user.role), permissions: user.permissions };
}

// Gate for admin surfaces that need no particular scope (the overview).
export async function requireAdmin(): Promise<AdminGate> {
  const sub = await currentSub();
  if (!sub) {
    return { ok: false };
  }
  const u = await loadAdminUser(sub);
  if (!u || !isAdminRole(u.role)) {
    return { ok: false };
  }
  return { ok: true, adminId: sub, role: u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN" };
}

// Gate for scoped /api/admin/* routes. Routes answer !gate.ok with the
// usual { error: "forbidden" } / 403, exactly like the old role check.
export async function requireAdminScope(scope: AdminScope): Promise<AdminGate> {
  const sub = await currentSub();
  if (!sub) {
    return { ok: false };
  }
  const u = await loadAdminUser(sub);
  if (!u) {
    return { ok: false };
  }
  if (!scopeAllows(u.role, u.permissions, scope)) {
    return { ok: false };
  }
  return { ok: true, adminId: sub, role: u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN" };
}

// Gate for the SUPER_ADMIN-only surface (/api/admin/users, /admin/users).
export async function requireSuperAdmin(): Promise<AdminGate> {
  const gate = await requireAdmin();
  if (!gate.ok || gate.role !== "SUPER_ADMIN") {
    return { ok: false };
  }
  return gate;
}