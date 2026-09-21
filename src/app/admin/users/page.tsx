"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, formatDate, inputCls } from "../ui";

type ScopeInfo = { code: string; label: string; hint: string };

type UserRow = {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  city: string | null;
  pincode: string | null;
  permissions: string[] | null;
  createdAt: string;
};

type EditState = {
  userId: string;
  role: string;
  scopes: string[];
};

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

const ERRORS: Record<string, string> = {
  forbidden: "Only a super admin can manage users.",
  invalid: "That change wasn't valid.",
  not_found: "That user no longer exists.",
  self_role: "You can't change your own role from here.",
};

function roleTone(role: string): "forest" | "leaf" | "cream" {
  if (role === "SUPER_ADMIN") {
    return "forest";
  }
  if (role === "ADMIN") {
    return "leaf";
  }
  return "cream";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [scopes, setScopes] = useState<ScopeInfo[]>([]);
  const [me, setMe] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) {
        setError(ERRORS[data.error] ?? "Could not load users.");
        setUsers([]);
        return;
      }
      setUsers(data.users);
      setScopes(data.scopes);
      setMe(data.me);
    } catch {
      setError("Could not load users — the database may be waking up.");
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function beginEdit(u: UserRow) {
    setEditing({
      userId: u.id,
      role: u.role,
      // never-managed (null) prefills as every scope ticked —
      // saving then makes the full list explicit.
      scopes: u.permissions === null ? scopes.map((s) => s.code) : u.permissions,
    });
  }

  async function save() {
    if (!editing || busy) {
      return;
    }
    setBusy(true);
    setError("");
    const body: { userId: string; role: string; permissions?: string[] } = {
      userId: editing.userId,
      role: editing.role,
    };
    if (editing.role === "ADMIN") {
      body.permissions = editing.scopes;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(ERRORS[data.error] ?? "Could not save.");
        return;
      }
      setEditing(null);
      await load();
    } catch {
      setError("Could not save — the database may be waking up.");
    } finally {
      setBusy(false);
    }
  }

  function scopeLabel(code: string): string {
    return scopes.find((s) => s.code === code)?.label ?? code;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1C3A2A]" style={SERIF}>
          Users
        </h1>
        <p className="text-sm text-[#66735F]">
          Roles and permission scopes — super admin only. Every change is written to the audit log.
        </p>
      </div>

      {error ? <ErrBox>{error}</ErrBox> : null}

      {users === null ? (
        <Loading label="Loading users…" />
      ) : users.length === 0 && !error ? (
        <Empty emoji="👥" title="No users yet" text="Users appear here as people sign in." />
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isMe = u.id === me;
            const isEditing = editing !== null && editing.userId === u.id;
            return (
              <Card key={u.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#1C3A2A]">
                      {u.name ?? u.phone}{" "}
                      {isMe ? <span className="text-xs text-[#8E9A84]">(you)</span> : null}
                    </p>
                    <p className="text-xs text-[#66735F]">
                      {u.phone}
                      {u.city ? ` · ${u.city}` : ""} · joined {formatDate(u.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={roleTone(u.role)}>{u.role.replace("_", " ")}</Pill>
                    {!isMe && !isEditing ? (
                      <Btn variant="outline" size="sm" onClick={() => beginEdit(u)}>
                        Edit
                      </Btn>
                    ) : null}
                  </div>
                </div>

                {u.role === "ADMIN" && !isEditing ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Scopes</span>
                    {u.permissions === null ? (
                      <Pill tone="leaf">All · never managed</Pill>
                    ) : u.permissions.length === 0 ? (
                      <Pill tone="amber">None</Pill>
                    ) : (
                      u.permissions.map((p) => (
                        <Pill key={p} tone="cream">
                          {scopeLabel(p)}
                        </Pill>
                      ))
                    )}
                  </div>
                ) : null}

                {isEditing && editing ? (
                  <div className="mt-4 space-y-3 rounded-2xl bg-[#F7F3E8] p-4">
                    <label className="block text-sm font-medium text-[#1C3A2A]">
                      Role
                      <select
                        className={inputCls + " mt-1"}
                        value={editing.role}
                        onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                      >
                        <option value="CUSTOMER">Customer</option>
                        <option value="SELLER">Seller</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super admin</option>
                      </select>
                    </label>

                    {editing.role === "ADMIN" ? (
                      <div>
                        <p className="text-sm font-medium text-[#1C3A2A]">Permission scopes</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {scopes.map((s) => (
                            <label
                              key={s.code}
                              className="flex items-start gap-2 rounded-xl border border-[#1C3A2A]/10 bg-white p-2.5"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 accent-[#2F6B3F]"
                                checked={editing.scopes.includes(s.code)}
                                onChange={(e) =>
                                  setEditing({
                                    ...editing,
                                    scopes: e.target.checked
                                      ? [...editing.scopes, s.code]
                                      : editing.scopes.filter((c) => c !== s.code),
                                  })
                                }
                              />
                              <span>
                                <span className="block text-sm font-semibold text-[#1C3A2A]">{s.label}</span>
                                <span className="block text-xs text-[#66735F]">{s.hint}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex gap-2">
                      <Btn variant="primary" size="sm" onClick={save} disabled={busy}>
                        {busy ? "Saving…" : "Save"}
                      </Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={busy}>
                        Cancel
                      </Btn>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}