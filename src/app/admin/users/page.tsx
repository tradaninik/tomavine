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

type AddState = {
  name: string;
  phone: string;
  scopes: string[];
};

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

const ERRORS: Record<string, string> = {
  forbidden: "Only a super admin can manage users.",
  invalid: "That change wasn't valid.",
  not_found: "That user no longer exists.",
  self_role: "You can't change your own role from here.",
  exists: "That phone already has an account.",
};

const PHONE_RE = /^\+91[6-9]\d{9}$/;

function roleTone(role: string): "forest" | "leaf" | "cream" {
  if (role === "SUPER_ADMIN") {
    return "forest";
  }
  if (role === "ADMIN") {
    return "leaf";
  }
  return "cream";
}

function ScopeGrid({
  scopes,
  checked,
  onToggle,
}: {
  scopes: ScopeInfo[];
  checked: string[];
  onToggle: (code: string, on: boolean) => void;
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {scopes.map((s) => (
        <label key={s.code} className="flex items-start gap-2 rounded-xl border border-[#1C3A2A]/10 bg-white p-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[#2F6B3F]"
            checked={checked.includes(s.code)}
            onChange={(e) => onToggle(s.code, e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-[#1C3A2A]">{s.label}</span>
            <span className="block text-xs text-[#66735F]">{s.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [scopes, setScopes] = useState<ScopeInfo[]>([]);
  const [me, setMe] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState<AddState | null>(null);
  const [addBusy, setAddBusy] = useState(false);

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

  // All five ticked = the never-managed state (null in the DB) —
  // same rule as nursery categories: unrestricted by default,
  // an explicit list only when something is deliberately withheld.
  function sendingAll(list: string[]): boolean {
    const codes = scopes.map((s) => s.code);
    return codes.length > 0 && list.length === codes.length && codes.every((c) => list.includes(c));
  }

  function beginEdit(u: UserRow) {
    setEditing({
      userId: u.id,
      role: u.role,
      // never-managed (null) prefills as every scope ticked —
      // saving with all five keeps null (unrestricted).
      scopes: u.permissions === null ? scopes.map((s) => s.code) : u.permissions,
    });
  }

  function beginAdd() {
    setAdd({ name: "", phone: "", scopes: scopes.map((s) => s.code) });
  }

  async function save() {
    if (!editing || busy) {
      return;
    }
    setBusy(true);
    setError("");
    const body: { userId: string; role: string; permissions?: string[] | null } = {
      userId: editing.userId,
      role: editing.role,
    };
    if (editing.role === "ADMIN") {
      body.permissions = sendingAll(editing.scopes) ? null : editing.scopes;
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

  async function createAdmin() {
    if (!add || addBusy) {
      return;
    }
    const name = add.name.trim();
    const phone = add.phone.trim();
    if (name.length < 2) {
      setError("Staff name needs at least 2 characters.");
      return;
    }
    if (!PHONE_RE.test(phone)) {
      setError("Phone must include +91 and look like +919000000042.");
      return;
    }
    if (add.scopes.length === 0) {
      setError("Tick at least one permission scope.");
      return;
    }
    setAddBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          permissions: sendingAll(add.scopes) ? null : add.scopes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(ERRORS[data.error] ?? "Could not create the staff admin.");
        return;
      }
      setAdd(null);
      await load();
    } catch {
      setError("Could not create — the database may be waking up.");
    } finally {
      setAddBusy(false);
    }
  }

  function scopeLabel(code: string): string {
    return scopes.find((s) => s.code === code)?.label ?? code;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1C3A2A]" style={SERIF}>
          Users &amp; staff
        </h1>
        <p className="text-sm text-[#66735F]">
          Add staff admins, set roles and permission scopes — super admin only. Every change is written to the audit log.
        </p>
      </div>

      {error ? <ErrBox>{error}</ErrBox> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-[#1C3A2A]">Staff admins</p>
            <p className="text-xs text-[#66735F]">
              Create an ADMIN account — they sign in with OTP on their phone, no password.
            </p>
          </div>
          <Btn variant="outline" size="sm" onClick={beginAdd} disabled={add !== null || scopes.length === 0}>
            Add staff admin
          </Btn>
        </div>
        {add !== null ? (
          <div className="mt-4 space-y-3 rounded-2xl bg-[#F7F3E8] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#1C3A2A]">
                Name
                <input
                  className={inputCls + " mt-1"}
                  value={add.name}
                  onChange={(e) => setAdd({ ...add, name: e.target.value })}
                  placeholder="Priya Sharma"
                />
              </label>
              <label className="block text-sm font-medium text-[#1C3A2A]">
                Phone
                <input
                  className={inputCls + " mt-1"}
                  value={add.phone}
                  onChange={(e) => setAdd({ ...add, phone: e.target.value })}
                  placeholder="+919000000042"
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C3A2A]">Permission scopes</p>
              <ScopeGrid
                scopes={scopes}
                checked={add.scopes}
                onToggle={(code, on) =>
                  setAdd({
                    ...add,
                    scopes: on ? [...add.scopes, code] : add.scopes.filter((c) => c !== code),
                  })
                }
              />
              {sendingAll(add.scopes) ? (
                <p className="mt-2 text-xs text-[#66735F]">
                  All five ticked — this admin gets full, unrestricted access.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Btn variant="primary" size="sm" onClick={createAdmin} disabled={addBusy}>
                {addBusy ? "Creating…" : "Create staff admin"}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setAdd(null)} disabled={addBusy}>
                Cancel
              </Btn>
            </div>
          </div>
        ) : null}
      </Card>

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
                        <ScopeGrid
                          scopes={scopes}
                          checked={editing.scopes}
                          onToggle={(code, on) =>
                            setEditing({
                              ...editing,
                              scopes: on ? [...editing.scopes, code] : editing.scopes.filter((c) => c !== code),
                            })
                          }
                        />
                        {sendingAll(editing.scopes) ? (
                          <p className="mt-2 text-xs text-[#66735F]">
                            All five ticked — saving keeps this admin unrestricted.
                          </p>
                        ) : null}
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