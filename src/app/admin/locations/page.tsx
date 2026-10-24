"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, Stat, inputCls } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

// ─────────────────────────────────────────────────────────────
// Delivery locations console (missions X2 + F).
//
// This is the MASTER list behind every storefront pincode dropdown
// and behind the "Locations served" pickers on the nursery forms.
//
// Who adds what (mission F — the franchise model):
//   • Nursery ADMINS add pincodes from their seller console
//     (Seller → Locations). A pincode nobody serves yet gets its
//     master row created automatically — the list grows from the
//     field.
//   • The SUPER ADMIN curates here: fix city/state labels, correct
//     a mistyped pincode, or switch a row off platform-wide.
//     Assigning which NURSERY serves which pincode happens on the
//     Nurseries console, not here.
//
// Nothing here blocks a pincode on the storefront — an unlisted
// pincode still works everywhere, it just gets no suggestion.
// ─────────────────────────────────────────────────────────────

type Loc = {
  id: string;
  pincode: string;
  city: string;
  state: string;
  active: boolean;
  createdAt: string;
  servingCount: number;
};

const PIN_RE = /^[1-9]\d{5}$/;

function errText(code: string): string {
  switch (code) {
    case "duplicate":
      return "Another row already uses that pincode — edit that row instead.";
    case "invalid":
      return "Check the form — pincode must be 6 digits (not starting with 0) and city at least 2 characters.";
    case "not_found":
      return "That row disappeared — reload the page.";
    default:
      return "Action failed — try again.";
  }
}

export default function AdminLocationsPage() {
  const [locs, setLocs] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [actError, setActError] = useState("");

  // edit form (curation only — adding happens in the seller console)
  const [editing, setEditing] = useState<Loc | null>(null);
  const [pin, setPin] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Stale-while-revalidate: state updates only land inside the
    // async callbacks, never synchronously in the effect body.
    fetch("/api/admin/locations")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data && Array.isArray(data.locations)) {
          setLocs(data.locations);
          setError(false);
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

  const activeCount = locs.filter((l) => l.active).length;
  const offCount = locs.length - activeCount;
  const cityCount = new Set(locs.filter((l) => l.active).map((l) => l.city.trim().toLowerCase())).size;
  const servingLinks = locs.reduce((sum, l) => sum + l.servingCount, 0);

  const q = query.trim().toLowerCase();
  const rows =
    q === ""
      ? locs
      : locs.filter(
          (l) => l.pincode.includes(q) || l.city.toLowerCase().includes(q) || l.state.toLowerCase().includes(q),
        );

  function openEdit(l: Loc) {
    setEditing(l);
    setPin(l.pincode);
    setCity(l.city);
    setStateName(l.state);
    setFormError("");
    setOkMsg("");
  }

  function closeForm() {
    setEditing(null);
    setFormError("");
  }

  async function submitEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || editing === null) {
      return;
    }
    setFormError("");
    const p = pin.trim();
    const c = city.trim();
    const s = stateName.trim();
    if (!PIN_RE.test(p)) {
      setFormError("Pincode must be 6 digits and not start with 0.");
      return;
    }
    if (c.length < 2) {
      setFormError("City needs at least 2 characters.");
      return;
    }
    if (s.length > 60) {
      setFormError("State is too long.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/locations/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: p, city: c, state: s }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) ?? "failed");
      }
      setOkMsg(`Saved ${p} — ${c}.`);
      closeForm();
      setReload((x) => x + 1);
    } catch (e) {
      setFormError(e instanceof Error ? errText(e.message) : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(l: Loc) {
    setBusyId(l.id);
    setActError("");
    setOkMsg("");
    try {
      const res = await fetch(`/api/admin/locations/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !l.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) ?? "failed");
      }
      setLocs((prev) => prev.map((x) => (x.id === l.id ? { ...x, active: !l.active } : x)));
      setOkMsg(
        l.active
          ? `${l.pincode} is off — it stops suggesting in the dropdowns until turned back on.`
          : `${l.pincode} is back on.`,
      );
    } catch (e) {
      setActError(e instanceof Error ? errText(e.message) : "Action failed");
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
        <p className="mb-2">Could not load locations — please retry. (If Neon was asleep, give it a few seconds first.)</p>
        <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
          Retry
        </Btn>
      </ErrBox>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={SERIF}>
            Delivery locations
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {okMsg ? <Pill tone="leaf">✓ {okMsg}</Pill> : null}
            {offCount > 0 ? <Pill tone="amber">{offCount} off</Pill> : null}
          </div>
        </div>
        <p className="max-w-3xl text-sm text-[#66735F]">
          The master serviceable-pincode list. <strong>Nursery admins add their own pincodes</strong> from their seller
          console (Seller → Locations) — new pincodes land here automatically. You curate: fix labels, correct a mistyped
          pincode, or switch a row off platform-wide. Which <em>nursery</em> serves which pincode is set on the{" "}
          <strong>Nurseries</strong> console.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Locations" value={String(locs.length)} hint={`${activeCount} active · ${offCount} off`} />
        <Stat label="Cities" value={String(cityCount)} hint="distinct cities among active rows" />
        <Stat label="Nursery links" value={String(servingLinks)} hint="nursery ↔ pincode service assignments" />
      </div>

      <div className="sm:max-w-md">
        <input
          className={inputCls}
          placeholder="Search pincode, city or state…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {actError ? <ErrBox>{actError}</ErrBox> : null}

      {editing ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-[#1C3A2A]" style={SERIF}>
              Edit — {editing.pincode}
            </h2>
            <Btn size="sm" variant="ghost" onClick={closeForm}>
              Cancel
            </Btn>
          </div>
          <form onSubmit={submitEdit} className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">Pincode</p>
                <input
                  className={inputCls}
                  value={pin}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="500001"
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">City</p>
                <input
                  className={inputCls}
                  value={city}
                  maxLength={60}
                  placeholder="Hyderabad"
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">State (optional)</p>
                <input
                  className={inputCls}
                  value={stateName}
                  maxLength={60}
                  list="tv-state-options"
                  placeholder="Telangana"
                  onChange={(e) => setStateName(e.target.value)}
                />
                <datalist id="tv-state-options">
                  <option value="Telangana" />
                  <option value="Andhra Pradesh" />
                  <option value="Karnataka" />
                </datalist>
              </div>
            </div>
            {formError ? <ErrBox>{formError}</ErrBox> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Btn type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </Btn>
              <span className="text-xs text-[#8E9A84]">The pincode can be fixed here — it stays the row&apos;s identity.</span>
            </div>
          </form>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Empty
          emoji="📍"
          title={query.trim() ? `Nothing matches “${query.trim()}”` : "No locations yet"}
          text={
            query.trim()
              ? "Try a shorter search, or clear it."
              : "Nursery admins add the pincodes they serve from their seller console (Seller → Locations) — everything they add appears here. Once rows exist, you can fix labels and toggle them off platform-wide."
          }
        />
      ) : (
        <div className="rounded-2xl border border-[#1C3A2A]/10 bg-white shadow-sm">
          <ul className="divide-y divide-[#E4E0CE]">
            {rows.map((l) => {
              const editingThis = editing !== null && editing.id === l.id;
              return (
                <li
                  key={l.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                    editingThis ? "bg-[#EDF2E6]" : l.active ? "" : "bg-[#F7F3E8]/50"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <code className="shrink-0 rounded-lg border border-[#1C3A2A]/10 bg-[#F7F3E8] px-2 py-1 font-mono text-sm font-bold text-[#20291D]">
                      {l.pincode}
                    </code>
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${l.active ? "text-[#20291D]" : "text-[#8E9A84]"}`}>
                        {l.city}
                      </p>
                      <p className="text-xs text-[#8E9A84]">{l.state || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.servingCount > 0 ? (
                      <Pill tone="cream">
                        {l.servingCount} nursery{l.servingCount > 1 ? "s" : ""}
                      </Pill>
                    ) : null}
                    {l.active ? <Pill tone="leaf">Active</Pill> : <Pill tone="rose">Off</Pill>}
                    <Btn size="sm" variant="ghost" onClick={() => (editingThis ? closeForm() : openEdit(l))}>
                      {editingThis ? "Close" : "Edit"}
                    </Btn>
                    <Btn
                      size="sm"
                      variant={l.active ? "outline" : "primary"}
                      disabled={busyId === l.id}
                      onClick={() => toggle(l)}
                    >
                      {l.active ? "Turn off" : "Turn on"}
                    </Btn>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
