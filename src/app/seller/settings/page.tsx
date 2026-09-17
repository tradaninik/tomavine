"use client";

import { useEffect, useState } from "react";
import { Btn, Card, Pill } from "../ui";

type Nursery = {
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
  ratingAvg: number;
};

const SCOPES = [
  { value: "RADIUS", label: "Within a radius of my nursery (km)" },
  { value: "CITY", label: "My whole city" },
  { value: "STATE", label: "My whole state" },
  { value: "INDIA", label: "All India (shipping)" },
];

export default function SellerSettingsPage() {
  const [nursery, setNursery] = useState<Nursery | null>(null);
  const [scope, setScope] = useState("RADIUS");
  const [scopeKm, setScopeKm] = useState("15");
  const [bulkOk, setBulkOk] = useState(true);
  const [retailOk, setRetailOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/seller/settings")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((json) => {
        const n: Nursery = json.nursery;
        setNursery(n);
        setScope(n.scope);
        setScopeKm(n.scopeKm === null ? "15" : String(n.scopeKm));
        setBulkOk(n.bulkOk);
        setRetailOk(n.retailOk);
      })
      .catch(() => setError("Could not load settings."));
  }, []);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/seller/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: scope,
          scopeKm: scope === "RADIUS" ? Number(scopeKm) : null,
          bulkOk: bulkOk,
          retailOk: retailOk,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Save failed");
      }

      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!nursery && !error) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1C3A2A]">Settings</h1>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="rounded-xl bg-[#2F6B3F]/10 px-4 py-2 text-sm text-[#2F6B3F]">Saved.</p> : null}

      {nursery ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-[#1C3A2A]">{nursery.name}</p>
              <p className="text-sm text-[#1C3A2A]/60">
                {nursery.area}, {nursery.city} — {nursery.pincode} · GSTIN {nursery.gstin}
              </p>
            </div>
            <Pill tone={nursery.status === "VERIFIED" ? "green" : "amber"}>{nursery.status}</Pill>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold text-[#1C3A2A]">Where do you sell?</h2>

        <div className="mt-3 space-y-2">
          {SCOPES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm text-[#1C3A2A]">
              <input
                type="radio"
                name="scope"
                value={s.value}
                checked={scope === s.value}
                onChange={() => setScope(s.value)}
              />
              {s.label}
            </label>
          ))}
        </div>

        {scope === "RADIUS" ? (
          <label className="mt-3 block text-sm font-medium text-[#1C3A2A]">
            Delivery radius (km)
            <input
              className="mt-1 w-40 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
              value={scopeKm}
              inputMode="numeric"
              onChange={(e) => setScopeKm(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        ) : null}

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[#1C3A2A]">
            <input
              type="checkbox"
              checked={retailOk}
              onChange={(e) => setRetailOk(e.target.checked)}
            />
            Sell to retail customers (homes, gardens)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1C3A2A]">
            <input
              type="checkbox"
              checked={bulkOk}
              onChange={(e) => setBulkOk(e.target.checked)}
            />
            Accept bulk / farmer orders (trays, acre-scale)
          </label>
        </div>

        <div className="mt-4">
          <Btn onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}