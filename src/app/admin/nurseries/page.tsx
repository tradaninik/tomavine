"use client";

import { useEffect, useState } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, formatDate, statusTone } from "../ui";

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