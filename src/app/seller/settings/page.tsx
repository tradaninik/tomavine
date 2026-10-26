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
  // Mission S3: site-wide bulk settings (tiers, max qty, pre-order, WhatsApp).
  const [siteTiers, setSiteTiers] = useState<{ minQty: number; pct: number }[]>([]);
  const [siteMaxQty, setSiteMaxQty] = useState("500");
  const [sitePreorder, setSitePreorder] = useState(true);
  const [siteWa, setSiteWa] = useState("");

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
        const site = json.site;
        if (site && Array.isArray(site.tiers)) {
          setSiteTiers(site.tiers.map((x: { minQty: number; pct: number }) => ({ minQty: x.minQty, pct: x.pct })));
          setSiteMaxQty(String(site.maxQty ?? 500));
          setSitePreorder(site.preorderEnabled !== false);
          setSiteWa(site.whatsappNumber ?? "");
        }
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
          siteConfig:
            siteTiers.length >= 1
              ? {
                  tiers: siteTiers,
                  maxQty: Number(siteMaxQty),
                  preorderEnabled: sitePreorder,
                  whatsappNumber: siteWa.trim() === "" ? null : siteWa.trim(),
                }
              : undefined,
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

      <Card>
        <h2 className="font-semibold text-[#1C3A2A]">Bulk pricing &amp; pre-orders (S3)</h2>
        <p className="mt-1 text-sm text-[#1C3A2A]/60">
          Tiers apply per line item at checkout. Changes apply immediately to new checkouts - no deploy needed.
        </p>

        <div className="mt-4 space-y-2">
          {siteTiers.map((tier, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="w-28 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2 text-sm"
                type="number"
                min={2}
                value={tier.minQty}
                onChange={(e) =>
                  setSiteTiers(siteTiers.map((x, ix) => (ix === i ? { ...x, minQty: Number(e.target.value) } : x)))
                }
              />
              <span className="text-sm text-[#1C3A2A]/60">or more units -&gt;</span>
              <input
                className="w-24 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2 text-sm"
                type="number"
                min={0}
                max={90}
                value={tier.pct}
                onChange={(e) =>
                  setSiteTiers(siteTiers.map((x, ix) => (ix === i ? { ...x, pct: Number(e.target.value) } : x)))
                }
              />
              <span className="text-sm text-[#1C3A2A]/60">% off that line</span>
              <button
                type="button"
                disabled={siteTiers.length <= 1}
                onClick={() => setSiteTiers(siteTiers.filter((_, ix) => ix !== i))}
                className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={siteTiers.length >= 6}
          onClick={() => setSiteTiers([...siteTiers, { minQty: 50, pct: 15 }])}
          className="mt-3 rounded-lg border-2 border-[#2F6B3F] px-4 py-2 text-sm font-semibold text-[#2F6B3F] hover:bg-[#EDF2E6] disabled:opacity-40"
        >
          + Add tier
        </button>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-[#1C3A2A]">
            Maximum quantity per item
            <input
              className="mt-1 w-40 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
              type="number"
              min={1}
              max={1000}
              value={siteMaxQty}
              onChange={(e) => setSiteMaxQty(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1C3A2A]">
            <input type="checkbox" checked={sitePreorder} onChange={(e) => setSitePreorder(e.target.checked)} />
            Accept pre-orders (out-of-stock products show a Pre-order button)
          </label>
          <label className="block text-sm font-medium text-[#1C3A2A]">
            WhatsApp number (digits only; leave empty to hide all WhatsApp buttons)
            <input
              className="mt-1 w-48 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
              inputMode="numeric"
              placeholder="9198XXXXXXXX"
              value={siteWa}
              onChange={(e) => setSiteWa(e.target.value.replace(/\D/g, "").slice(0, 15))}
            />
          </label>
        </div>
        <p className="mt-4 text-xs text-[#1C3A2A]/50">
          The Save button above saves these settings together with your nursery profile.
        </p>
      </Card>
    </div>
  );
}