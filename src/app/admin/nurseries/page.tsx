"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, formatDate, inputCls, statusTone } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

type NurseryRow = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  gstin: string;
  city: string;
  area: string;
  pincode: string;
  scope: string;
  scopeKm: number | null;
  bulkOk: boolean;
  retailOk: boolean;
  status: string;
  physVerifiedAt: string | null;
  growArea: string | null;
  ratingAvg: number;
  productCount: number;
  ownerName: string | null;
  ownerPhone: string;
};

type MeInfo = { role: string } | null;

type OnboardForm = {
  ownerName: string;
  ownerDigits: string;
  name: string;
  nurseryDigits: string;
  gstin: string;
  city: string;
  area: string;
  pincode: string;
  scope: string;
  scopeKm: string;
  retailOk: boolean;
  bulkOk: boolean;
  growArea: string;
};

const EMPTY_ONBOARD: OnboardForm = {
  ownerName: "",
  ownerDigits: "",
  name: "",
  nurseryDigits: "",
  gstin: "",
  city: "",
  area: "",
  pincode: "",
  scope: "RADIUS",
  scopeKm: "15",
  retailOk: true,
  bulkOk: true,
  growArea: "",
};

const SCOPE_OPTIONS = [
  { value: "RADIUS", label: "Radius — km around the nursery" },
  { value: "CITY", label: "City-wide" },
  { value: "STATE", label: "State-wide" },
  { value: "INDIA", label: "Ships across India" },
];

const TABS = ["all", "PENDING", "VERIFIED", "REJECTED"] as const;

function scopeText(row: NurseryRow): string {
  if (row.scope === "INDIA") {
    return "Ships across India";
  }
  if (row.scope === "STATE") {
    return "State-wide";
  }
  if (row.scope === "CITY") {
    return `Within ${row.city}`;
  }
  if (row.scope === "RADIUS") {
    return row.scopeKm ? `~${row.scopeKm} km around ${row.city}` : `Local around ${row.city}`;
  }
  return row.scope;
}

function tabCls(active: boolean): string {
  return active
    ? "rounded-xl bg-[#2F6B3F] px-4 py-1.5 text-sm font-semibold text-white"
    : "rounded-xl px-4 py-1.5 text-sm font-semibold text-[#1C3A2A]/60 hover:bg-[#F7F3E8]";
}

export default function AdminNurseriesPage() {
  const [rows, setRows] = useState<NurseryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actError, setActError] = useState("");

  const [me, setMe] = useState<MeInfo>(null);
  const [form, setForm] = useState<OnboardForm>(EMPTY_ONBOARD);
  const [nurseryPhoneTouched, setNurseryPhoneTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch("/api/admin/nurseries")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data && Array.isArray(data.nurseries)) {
          setRows(data.nurseries);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && data.user) {
          setMe({ role: String(data.user.role) });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  async function act(id: string, action: "verify" | "reject", name: string) {
    if (action === "reject") {
      const sure = window.confirm(`Reject ${name}? Its products will be hidden from the storefront until re-verified.`);
      if (!sure) {
        return;
      }
    }
    setBusyId(id);
    setActError("");
    try {
      const res = await fetch(`/api/admin/nurseries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      setReload((x) => x + 1);
    } catch (e) {
      setActError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function setField<K extends keyof OnboardForm>(key: K, value: OnboardForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateOnboard(): string[] {
    const problems: string[] = [];
    if (form.ownerName.trim().length < 2) problems.push("Owner name — at least 2 characters.");
    if (!/^[6-9]\d{9}$/.test(form.ownerDigits)) problems.push("Owner phone — 10 digits starting with 6-9.");
    if (form.name.trim().length < 2) problems.push("Nursery name — at least 2 characters.");
    if (!/^[6-9]\d{9}$/.test(form.nurseryDigits)) problems.push("Nursery phone — 10 digits starting with 6-9.");
    if (!/^[0-9A-Za-z]{15}$/.test(form.gstin.trim())) problems.push("GSTIN — exactly 15 letters/digits.");
    if (form.city.trim().length < 2) problems.push("City — at least 2 characters.");
    if (form.area.trim().length < 2) problems.push("Area — at least 2 characters.");
    if (!/^[1-9]\d{5}$/.test(form.pincode.trim())) problems.push("Pincode — 6 digits, not starting with 0.");
    if (form.scope === "RADIUS") {
      const km = Number(form.scopeKm);
      if (!Number.isInteger(km) || km < 1 || km > 100) problems.push("Delivery radius — a whole number of km between 1 and 100.");
    }
    if (!form.retailOk && !form.bulkOk) problems.push("Sells — enable retail, bulk, or both.");
    return problems;
  }

  async function submitOnboard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) {
      return;
    }
    setFormError("");
    setFormOk("");
    const problems = validateOnboard();
    if (problems.length > 0) {
      setFormError(problems[0] + (problems.length > 1 ? ` (${problems.length - 1} more field${problems.length > 2 ? "s" : ""} to fix)` : ""));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/nurseries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: form.ownerName.trim(),
          ownerPhone: "+91" + form.ownerDigits,
          name: form.name.trim(),
          phone: "+91" + form.nurseryDigits,
          gstin: form.gstin.trim().toUpperCase(),
          city: form.city.trim(),
          area: form.area.trim(),
          pincode: form.pincode.trim(),
          scope: form.scope,
          scopeKm: form.scope === "RADIUS" ? Number(form.scopeKm) : null,
          bulkOk: form.bulkOk,
          retailOk: form.retailOk,
          growArea: form.growArea.trim().length > 0 ? form.growArea.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "failed");
      }
      setFormOk(data.nursery.name + " created — it is in the PENDING queue below. The owner can now log in with their phone as a seller.");
      setForm(EMPTY_ONBOARD);
      setNurseryPhoneTouched(false);
      setTab("PENDING");
      setReload((x) => x + 1);
    } catch (err) {
      const code = err instanceof Error ? err.message : "failed";
      if (code === "duplicate") {
        setFormError("That owner phone already has an account — existing owners should use the public 'List your nursery' page instead.");
      } else if (code === "forbidden") {
        setFormError("Only the super admin can onboard nurseries.");
      } else if (code === "invalid") {
        setFormError("Some fields need attention — please check the form and retry.");
      } else {
        setFormError("Could not create the nursery — please retry.");
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrBox>
        <p className="mb-2">Could not load nurseries — please retry.</p>
        <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
          Retry
        </Btn>
      </ErrBox>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={SERIF}>
          Nurseries
        </h1>
        {pendingCount > 0 ? <Pill tone="amber">🚨 {pendingCount} pending verification</Pill> : null}
      </div>

      {me?.role === "SUPER_ADMIN" ? (
        <Card>
          <p className="text-xl font-semibold text-[#20291D]" style={SERIF}>
            ➕ Onboard a nursery
          </p>
          <p className="mt-1 text-xs text-[#66735F]">
            Creates the owner account (seller) and the nursery in one step. The nursery lands in the pending queue below for physical verification — verify it whenever the check is done.
          </p>
          <form onSubmit={submitOnboard} className="mt-4 space-y-4">
            <div className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Owner name</span>
                <input
                  className={inputCls}
                  value={form.ownerName}
                  maxLength={80}
                  placeholder="e.g. Priya Sharma"
                  onChange={(e) => setField("ownerName", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Owner phone</span>
                <input
                  className={inputCls}
                  value={form.ownerDigits}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setForm((f) => ({ ...f, ownerDigits: digits }));
                    if (!nurseryPhoneTouched) {
                      setForm((f) => ({ ...f, nurseryDigits: digits }));
                    }
                  }}
                />
                <span className="mt-1 block text-xs text-[#8E9A84]">+91 added automatically. Must not already have an account.</span>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Nursery name</span>
                <input
                  className={inputCls}
                  value={form.name}
                  maxLength={120}
                  placeholder="e.g. Rose Garden Nurseries"
                  onChange={(e) => setField("name", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Nursery phone</span>
                <input
                  className={inputCls}
                  value={form.nurseryDigits}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  onChange={(e) => {
                    setNurseryPhoneTouched(true);
                    setForm((f) => ({ ...f, nurseryDigits: e.target.value.replace(/\D/g, "").slice(0, 10) }));
                  }}
                />
                <span className="mt-1 block text-xs text-[#8E9A84]">Prefilled with the owner's number — change if the nursery has its own.</span>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">GSTIN</span>
                <input
                  className={inputCls}
                  value={form.gstin}
                  maxLength={15}
                  placeholder="15-character GSTIN"
                  onChange={(e) => setField("gstin", e.target.value.toUpperCase())}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">City</span>
                <input
                  className={inputCls}
                  value={form.city}
                  maxLength={80}
                  placeholder="e.g. Bengaluru"
                  onChange={(e) => setField("city", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Area</span>
                <input
                  className={inputCls}
                  value={form.area}
                  maxLength={120}
                  placeholder="e.g. Hessarghatta"
                  onChange={(e) => setField("area", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Pincode</span>
                <input
                  className={inputCls}
                  value={form.pincode}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="560088"
                  onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Delivery scope</span>
                <select
                  className={inputCls}
                  value={form.scope}
                  onChange={(e) => setField("scope", e.target.value)}
                >
                  {SCOPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.scope === "RADIUS" ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Radius (km)</span>
                  <input
                    className={inputCls}
                    value={form.scopeKm}
                    inputMode="numeric"
                    maxLength={3}
                    placeholder="15"
                    onChange={(e) => setField("scopeKm", e.target.value.replace(/\D/g, ""))}
                  />
                </label>
              ) : null}
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Sells</span>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#20291D]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.retailOk}
                      onChange={(e) => setField("retailOk", e.target.checked)}
                    />
                    Retail
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.bulkOk}
                      onChange={(e) => setField("bulkOk", e.target.checked)}
                    />
                    Bulk
                  </label>
                </div>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Growing area (optional)</span>
                <input
                  className={inputCls}
                  value={form.growArea}
                  maxLength={200}
                  placeholder="e.g. 2 acres near Hessarghatta lake"
                  onChange={(e) => setField("growArea", e.target.value)}
                />
              </label>
            </div>

            {formError ? <ErrBox>{formError}</ErrBox> : null}
            {formOk ? (
              <p className="rounded-xl bg-[#2F6B3F]/10 px-3 py-2 text-sm font-semibold text-[#2F6B3F]">{formOk}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-[#E4E0CE] pt-4">
              <Btn type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create nursery"}
              </Btn>
              <span className="text-xs text-[#8E9A84]">Creates the owner + nursery together; every creation is audit-logged.</span>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {TABS.map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)} className={tabCls(tab === tb)}>
            {tb === "all" ? `All (${rows.length})` : `${tb.charAt(0)}${tb.slice(1).toLowerCase()} (${rows.filter((r) => r.status === tb).length})`}
          </button>
        ))}
      </div>

      {actError ? <ErrBox>{actError}</ErrBox> : null}

      {filtered.length === 0 ? (
        <Empty emoji="🏡" title="No nurseries in this view" text="New seller signups land here for physical verification." />
      ) : (
        <div className="space-y-4">
          {filtered.map((n) => {
            const busy = busyId === n.id;
            return (
              <Card key={n.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-[#20291D]" style={SERIF}>
                      🏡 {n.name}
                    </p>
                    <p className="text-xs text-[#8E9A84]">
                      /{n.slug} · {n.productCount} products · ⭐ {n.ratingAvg.toFixed(1)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(n.status)}`}>
                    {n.status}
                    {n.physVerifiedAt ? ` · ${formatDate(n.physVerifiedAt)}` : ""}
                  </span>
                </div>

                <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Owner</p>
                    <p className="mt-0.5 text-[#20291D]">
                      {n.ownerName ?? "—"} · {n.ownerPhone}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Location</p>
                    <p className="mt-0.5 text-[#20291D]">
                      {n.city}
                      {n.area ? `, ${n.area}` : ""} — {n.pincode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">GSTIN</p>
                    <p className="mt-0.5 text-[#20291D]">{n.gstin}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Growing area</p>
                    <p className="mt-0.5 text-[#20291D]">{n.growArea ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Delivery scope</p>
                    <p className="mt-0.5 text-[#20291D]">{scopeText(n)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Sells</p>
                    {n.retailOk ? <Pill tone="leaf">Retail</Pill> : null}
                    {n.bulkOk ? <Pill tone="sky">Bulk</Pill> : null}
                    {!n.retailOk && !n.bulkOk ? <Pill tone="rose">Nothing</Pill> : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E4E0CE] pt-4">
                  {n.status !== "VERIFIED" ? (
                    <Btn onClick={() => act(n.id, "verify", n.name)} disabled={busy}>
                      ✓ Verify (physical check done)
                    </Btn>
                  ) : null}
                  {n.status !== "REJECTED" ? (
                    <Btn variant="danger" onClick={() => act(n.id, "reject", n.name)} disabled={busy}>
                      ✕ Reject
                    </Btn>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}