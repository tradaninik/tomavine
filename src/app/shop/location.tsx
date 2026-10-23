"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { DISTRICTS, STATES, districtByCode, districtName, nearestDistrict } from "@/lib/geo";
import { useLang } from "@/lib/i18n";
import { toast } from "./ui";

// ─────────────────────────────────────────────────────────────
// Location backbone UI (Feature: Location Backbone v1).
//
// The customer's district is stored in localStorage under
// tomavine_geo_v1 and broadcast via the tomavine:geo window event
// (same pattern as the cart). Nothing here touches the network —
// district snapping and ETA math are pure functions in
// src/lib/geo.ts.
//
// Geolocation fires ONLY when the customer taps the chip — never
// automatically on page load (conversion-safe, no surprise popup).
// ─────────────────────────────────────────────────────────────

export const GEO_KEY = "tomavine_geo_v1";
export const GEO_EVENT = "tomavine:geo";

export type GeoPick = { code: string; source: "gps" | "manual" };

export function loadGeo(): GeoPick | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(GEO_KEY);
    if (!raw) return null;
    const pick = JSON.parse(raw) as { code?: unknown; source?: unknown };
    if (pick && typeof pick.code === "string" && districtByCode(pick.code)) {
      return { code: pick.code, source: pick.source === "gps" ? "gps" : "manual" };
    }
  } catch {
    // private browsing or corrupt value — treat as unset
  }
  return null;
}

export function saveGeo(pick: GeoPick | null): void {
  try {
    if (pick) {
      window.localStorage.setItem(GEO_KEY, JSON.stringify(pick));
    } else {
      window.localStorage.removeItem(GEO_KEY);
    }
  } catch {
    // private browsing — keep in memory via the event below
  }
  window.dispatchEvent(new Event(GEO_EVENT));
}

// useSyncExternalStore plumbing: localStorage is an external store,
// so React 19 lets us subscribe to it directly — no effects, no
// hydration mismatch (server snapshot is always null). A tiny cache
// keeps snapshot references stable between events.
const geoCache: { value: GeoPick | null; valid: boolean } = { value: null, valid: false };

function subscribeGeo(onChange: () => void): () => void {
  const wrapped = () => {
    geoCache.valid = false;
    onChange();
  };
  window.addEventListener(GEO_EVENT, wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener(GEO_EVENT, wrapped);
    window.removeEventListener("storage", wrapped);
  };
}

function getGeoSnapshot(): GeoPick | null {
  if (!geoCache.valid) {
    geoCache.value = loadGeo();
    geoCache.valid = true;
  }
  return geoCache.value;
}

function getServerGeoSnapshot(): GeoPick | null {
  return null;
}

export function useGeo(): { geo: GeoPick | null } {
  const geo = useSyncExternalStore(subscribeGeo, getGeoSnapshot, getServerGeoSnapshot);
  return { geo: geo };
}

// Requests browser geolocation, snaps to the nearest seeded district
// and saves it. Denial / failure falls back to the district picker.
// All user-facing strings are passed in so this stays testable and
// free of module-scope state.
function detectDistrict(
  strings: { setDone: (d: string) => string; tooFar: string; denied: string; err: string },
  lang: string,
  onDone: () => void,
): void {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    toast(strings.err);
    onDone();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { district, distanceKm } = nearestDistrict(pos.coords.latitude, pos.coords.longitude);
      saveGeo({ code: district.code, source: "gps" });
      onDone();
      // A snap far outside TG/AP/KA still picks the closest district —
      // tell the customer so they can correct it manually.
      toast(
        distanceKm > 150
          ? strings.setDone(districtName(district.code, lang)) + " · " + strings.tooFar
          : strings.setDone(districtName(district.code, lang)),
      );
    },
    (err) => {
      onDone();
      toast(err.code === err.PERMISSION_DENIED ? strings.denied : strings.err);
    },
    { timeout: 8000, maximumAge: 300000 },
  );
}

export function LocationChip() {
  const { t, lang } = useLang();
  const { geo } = useGeo();
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);

  function chipTap() {
    if (geo) {
      setOpen(true);
      return;
    }
    setDetecting(true);
    detectDistrict(
      {
        setDone: (d) => t("loc_set_done", { d: d }),
        tooFar: t("loc_too_far"),
        denied: t("loc_denied"),
        err: t("loc_err"),
      },
      lang,
      () => setDetecting(false),
    );
  }

  const label = geo ? t("loc_deliver_to", { d: districtName(geo.code, lang) }) : t("loc_set");

  return (
    <>
      <button
        type="button"
        onClick={chipTap}
        disabled={detecting}
        aria-label={label}
        className="hidden min-w-0 max-w-44 items-center gap-1.5 rounded-xl border border-[#D6D2BC] bg-white px-3 py-2 text-sm font-semibold text-[#1C3A2A] transition hover:border-[#2F6B3F] lg:flex"
      >
        <span aria-hidden="true">📍</span>
        <span className="truncate">{detecting ? t("loc_detecting") : label}</span>
      </button>
      {/* Compact icon-only chip on small screens */}
      <button
        type="button"
        onClick={chipTap}
        disabled={detecting}
        aria-label={label}
        className="rounded-xl border border-[#D6D2BC] bg-white px-2.5 py-2 text-sm font-semibold text-[#1C3A2A] transition hover:border-[#2F6B3F] lg:hidden"
      >
        <span aria-hidden="true">📍</span>
      </button>
      <DistrictPicker
        open={open}
        onClose={() => setOpen(false)}
        onDetect={() =>
          detectDistrict(
            {
              setDone: (d) => t("loc_set_done", { d: d }),
              tooFar: t("loc_too_far"),
              denied: t("loc_denied"),
              err: t("loc_err"),
            },
            lang,
            () => undefined,
          )
        }
      />
    </>
  );
}

export function DistrictPicker({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect?: () => void;
}) {
  // The body is keyed so a fresh mount clears the search box every
  // time the picker opens (no setState-in-effect reset).
  if (!open) return null;
  return <PickerBody onClose={onClose} onDetect={onDetect} />;
}

function PickerBody({ onClose, onDetect }: { onClose: () => void; onDetect?: () => void }) {
  const { t, lang } = useLang();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DISTRICTS;
    return DISTRICTS.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        (d.te ?? "").includes(q.trim()) ||
        (d.kn ?? "").includes(q.trim()),
    );
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-[#1C3A2A]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("loc_pick")}
        className="relative z-10 max-h-[88vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[#20291D]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              📍 {t("loc_pick")}
            </p>
            <p className="mt-0.5 text-xs text-[#66735F]">{t("loc_pick_s")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-lg text-[#66735F] transition hover:bg-[#F7F3E8]"
          >
            ✕
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("loc_search")}
          aria-label={t("loc_search")}
          className="mb-3 w-full rounded-xl border border-[#D6D2BC] bg-[#F7F3E8] px-4 py-2.5 text-sm outline-none transition focus:border-[#2F6B3F]"
        />

        {onDetect ? (
          <button
            type="button"
            onClick={() => {
              onDetect();
              onClose();
            }}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F6B3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24562F]"
          >
            <span aria-hidden="true">🛰️</span> {t("loc_detect")}
          </button>
        ) : null}

        <div className="max-h-96 overflow-y-auto pr-1">
          {STATES.map((st) => {
            const rows = filtered.filter((d) => d.state === st.code);
            if (rows.length === 0) return null;
            return (
              <div key={st.code} className="mb-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8E9A84]">{t("state_" + st.code)}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {rows.map((d) => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => {
                        saveGeo({ code: d.code, source: "manual" });
                        onClose();
                      }}
                      className="rounded-xl border border-[#E4E0CE] px-3 py-2.5 text-left text-sm font-semibold text-[#20291D] transition hover:border-[#2F6B3F] hover:bg-[#EDF2E6]"
                    >
                      {districtName(d.code, lang)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? <p className="py-6 text-center text-sm text-[#66735F]">{t("loc_none")}</p> : null}
        </div>
      </div>
    </div>
  );
}
