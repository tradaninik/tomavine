import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin, ADMIN_SCOPES, SCOPE_META, isAdminScope } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// Admin users console — SUPER_ADMIN-only API.
//
// GET   → every user plus the scope catalogue (the page is a
//         client component and must not import the permissions
//         lib, which pulls the database in). Also returns `me`
//         so the page can lock your own row.
//
// PATCH → change a user's role and/or assign their scope list.
//         ONLY SUPER_ADMIN reaches this route at all, and every
//         change is AuditLogged. permissions: null clears the
//         list back to "never managed" (= all scopes for an
//         ADMIN); [] means genuinely no scopes. You cannot
//         change your OWN role here — demoting the last super
//         admin would lock everyone out of this console.
// ─────────────────────────────────────────────────────────────

const PatchBody = z.object({
  userId: z.string().min(1),
  role: z.enum(["CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"]).optional(),
  permissions: z.array(z.string().refine(isAdminScope)).nullable().optional(),
});

// Prisma refuses plain `null` for a JSON column on update —
// DbNull means "store SQL NULL" (the never-managed state).
function permsUpdate(value: string[] | null) {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

export async function GET() {
  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      city: true,
      pincode: true,
      permissions: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    me: gate.adminId,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      city: u.city,
      pincode: u.pincode,
      permissions: u.permissions,
      createdAt: u.createdAt.toISOString(),
    })),
    scopes: ADMIN_SCOPES.map((code) => ({ code, ...SCOPE_META[code] })),
  });
}

export async function PATCH(req: Request) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = gate.adminId;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { userId, role, permissions } = parsed.data;
  if (role === undefined && permissions === undefined) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (userId === adminId && role !== undefined && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "self_role" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      role,
      permissions: permissions === undefined ? undefined : permsUpdate(permissions),
    },
  });
  const changed: string[] = [];
  if (role !== undefined && role !== user.role) {
    changed.push("role");
  }
  if (permissions !== undefined) {
    changed.push("permissions");
  }
  await db.auditLog.create({
    data: {
      actorId: adminId,
      action: "user.update",
      entity: `User:${userId}`,
      meta: {
        phone: user.phone,
        fields: changed.join(","),
        roleFrom: role !== undefined ? String(user.role) : null,
        roleTo: role ?? null,
        permissions: permissions ?? null,
        permissionsFrom: user.permissions === null ? null : user.permissions,
      },
    },
  });
  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      role: updated.role,
      city: updated.city,
      pincode: updated.pincode,
      permissions: updated.permissions,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}