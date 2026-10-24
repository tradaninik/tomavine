"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Btn, Card, Pill } from "../ui";

// ─────────────────────────────────────────────────────────────
// Seller "Locations" (mission F) — the nursery admin's own list
// of served pincodes.
//
// This is where pincodes get ADDED in the franchise model: pick a
// known pincode from the master list (city/state autofill) or type
// a brand-new one (it joins the master list for everyone). A
// customer searching a pincode you serve sees your nursery with a
// "Delivers to your pincode" verdict, ahead of the scope
// heuristics.
//
// If the super admin switched "Manage service locations" off for
// this nursery, the list stays visible but read-only.
// ─────────────────────────────────────────────────────────────

type MasterLoc = { id: string; pincode: string; city: string; state: string };
type MyArea = { locationId: string; pincode: string; city: string; state: string };

const PIN_RE = /^[1-9]\d{5}$/;

export default function SellerLocationsPage() {
  const [master, setMaster] = useState<MasterLoc[]>([]);
  const [mine, setMine] = useState<MyArea[]>([]);
  const [canManage, setCanManage] = useState(true);
  const [maxAreas, setMaxAreas] = useState(200);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);

  const [pin, setPin] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Stale-while-revalidate: state updates only land inside the
    // async callbacks, never synchronously in the effect body.
    fetch("/api/seller/locations")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!active) {
          return;
        }
        setMaster(Array.isArray(data.master) ? data.master : []);
        setMine(Array.isArray(data.mine) ? data.mine : []);
        setCanManage(data.canManage !== false);
        setMaxAreas(typeof data.maxAreas === "number" ? data.maxAreas : 200);
      })
      .catch(() => {
        if (active) {
          setLoadError("Could not load your locations — are you logged in as the nursery owner?");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  // Typing a known pincode autofills its city/state — the master
  // row's labels stay canonical when saved.
  function onPinChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    if (PIN_RE.test(digits)) {
      const known = master.find((m) => m.pincode === digits);
      if (known) {
        setCity(known.city);
        setStateName(known.state);
      }
    }
  }

  async function addArea(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (adding) {
      return;
    }
    setAddError("");
    setOkMsg("");
    const p = pin.trim();
    const c = city.trim();
    const s = stateName.trim();
    if (!PIN_RE.test(p)) {
      setAddError("Pincode must be 6 digits, not starting with 0.");
      return;
    }
    if (c.length < 2) {
      setAddError("City needs at least 2 characters.");
      return;
    }
    if (mine.some((m) => m.pincode === p)) {
      setAddError("You already serve that pincode.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/seller/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: p, city: c, state: s }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not add that location.");
      }
      setOkMsg(`Now serving ${p} — ${c}. Customers there see your nursery first.`);
      setPin("");
      setCity("");
      setStateName("");
      setReload((x) => x + 1);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add that location.");
    } finally {
      setAdding(false);
    }
  }

  async function removeArea(a: MyArea) {
    if (busyId) {
      return;
    }
    setBusyId(a.locationId);
    setAddError("");
    setOkMsg("");
    try {
      const res = await fetch(`/api/seller/locations/${a.locationId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not remove that pincode.");
      }
      setOkMsg(`Removed ${a.pincode}.`);
      setReload((x) => x + 1);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not remove that pincode.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  if (loadError) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>;
  }

  const atCap = mine.length >= maxAreas;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C3A2A]">Locations</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#1C3A2A]/70">
          The pincodes your nursery delivers to. Customers searching these pincodes see your nursery with a
          &ldquo;Delivers to your pincode&rdquo; badge. Adding a pincode nobody serves yet is fine — it joins the shared
          master list.
        </p>
      </div>

      {!canManage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          🔒 Your service locations are currently managed by Tomavine support. Contact us to add or remove a pincode —
          the list below stays visible either way.
        </div>
      ) : null}

      {okMsg ? (
        <p className="rounded-xl bg-[#2F6B3F]/10 px-4 py-2 text-sm font-semibold text-[#2F6B3F]">✓ {okMsg}</p>
      ) : null}
      {addError ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{addError}</p> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-[#1C3A2A]">
            Pincodes you serve{" "}
            <span className="text-sm font-normal text-[#1C3A2A]/60">
              ({mine.length}
              {canManage ? ` of ${maxAreas}` : ""})
            </span>
          </h2>
          {mine.length > 0 ? <Pill tone="green">{mine.length} served</Pill> : null}
        </div>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-[#1C3A2A]/60">
            None yet — add your first pincode below. Until then, customers still find you by city and delivery scope.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mine.map((a) => (
              <li
                key={a.locationId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1C3A2A]/10 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <code className="rounded-lg bg-[#F7F3E8] px-2 py-1 font-mono text-sm font-bold text-[#20291D]">
                    {a.pincode}
                  </code>
                  <span className="text-sm text-[#20291D]">
                    {a.city}
                    {a.state ? `, ${a.state}` : ""}
                  </span>
                </div>
                {canManage ? (
                  <Btn kind="danger" onClick={() => removeArea(a)} disabled={busyId === a.locationId}>
                    {busyId === a.locationId ? "Removing…" : "Remove"}
                  </Btn>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage ? (
        <Card>
          <h2 className="font-semibold text-[#1C3A2A]">Add a pincode you serve</h2>
          <p className="mt-1 text-xs text-[#1C3A2A]/60">
            Start typing a pincode — known pincodes autofill their city and state. New pincodes need both filled in.
          </p>
          <form onSubmit={addArea} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#66735F]">Pincode</span>
                <input
                  className="w-full rounded-xl border border-[#1C3A2A]/15 bg-white px-3 py-2 text-sm text-[#1C3A2A] outline-none transition focus:border-[#2F6B3F] focus:ring-2 focus:ring-[#2F6B3F]/20"
                  value={pin}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="500001"
                  list="tv-seller-master-pins"
                  onChange={(e) => onPinChange(e.target.value)}
                />
                <datalist id="tv-seller-master-pins">
                  {master.map((m) => (
                    <option key={m.id} value={m.pincode}>
                      {`${m.city}${m.state ? `, ${m.state}` : ""} — ${m.pincode}`}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#66735F]">City</span>
                <input
                  className="w-full rounded-xl border border-[#1C3A2A]/15 bg-white px-3 py-2 text-sm text-[#1C3A2A] outline-none transition focus:border-[#2F6B3F] focus:ring-2 focus:ring-[#2F6B3F]/20"
                  value={city}
                  maxLength={60}
                  placeholder="Hyderabad"
                  onChange={(e) => setCity(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#66735F]">State</span>
                <input
                  className="w-full rounded-xl border border-[#1C3A2A]/15 bg-white px-3 py-2 text-sm text-[#1C3A2A] outline-none transition focus:border-[#2F6B3F] focus:ring-2 focus:ring-[#2F6B3F]/20"
                  value={stateName}
                  maxLength={60}
                  placeholder="Telangana"
                  onChange={(e) => setStateName(e.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={adding || atCap}
                className="rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255732] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adding ? "Adding…" : atCap ? `Limit reached (${maxAreas})` : "+ Add pincode"}
              </button>
              <span className="text-xs text-[#8E9A84]">Removal is instant; nothing on the storefront is ever blocked.</span>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
