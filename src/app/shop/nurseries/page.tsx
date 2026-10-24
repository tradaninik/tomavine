"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Btn, Empty, ErrBox, Loading, Pill, SectionTitle, StarRow, inputCls } from "../ui";
import { useLang } from "@/lib/i18n";
import { districtName } from "@/lib/geo";
import { DistrictPicker, useGeo } from "../location";
import { LOCATION_LIST_ID, LocationDatalist } from "@/lib/location-options";

type Verdict = { delivers: boolean; label: string };

type Eta = { band: string; minDays: number; maxDays: number };

type NurseryRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string;
  pincode: string;
  scope: string;
  scopeKm: number | null;
  ratingAvg: number;
  retailOk: boolean;
  bulkOk: boolean;
  physVerifiedAt: string | null;
  districtCode: string | null;
  productCount: number;
  distanceKm: number | null;
  eta: Eta | null;
  verdict: Verdict | null;
};

export default function NurseriesPage() {
  const { t, lang } = useLang();
  const { geo } = useGeo();
  const [rows, setRows] = useState<NurseryRow[]>([]);
  const [pin, setPin] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [pinInvalid, setPinInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.user && typeof data.user.pincode === "string" && data.user.pincode.length > 0) {
          setPin(data.user.pincode);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (applied) params.set("pincode", applied);
    if (geo) params.set("district", geo.code);
    const qs = params.toString();
    const url = qs ? `/api/catalog/nurseries?${qs}` : "/api/catalog/nurseries";
    fetch(url)
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
  }, [applied, geo, reload]);

  function applyPin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = pin.trim();
    if (/^[1-9]\d{5}$/.test(value)) {
      setPinInvalid(false);
      setApplied(value);
    } else {
      setPinInvalid(true);
    }
  }

  // Distance / ETA pill per row — same-district rows say so, the rest
  // quote a day band with the distance.
  function etaLabel(row: NurseryRow): string {
    if (!row.eta) return "";
    if (geo && row.districtCode === geo.code) {
      return t("eta_same", { d: districtName(geo.code, lang) });
    }
    if (row.distanceKm === null) {
      return t("eta_unknown");
    }
    const key = row.eta.band === "far" ? "eta_far" : row.eta.band === "state" ? "eta_state" : "eta_nearby";
    return t(key, { km: row.distanceKm });
  }

  return (
    <div>
      <SectionTitle>🏡 {t("nurseries")}</SectionTitle>
      <p className="mb-4 max-w-2xl text-sm text-[#66735F]">{t("pin_search")}</p>
      <p className="mb-4 text-xs text-[#66735F]">{t("legal_eta_note")}</p>

      {geo ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#2F6B3F]/30 bg-[#EDF2E6]/70 px-4 py-3 text-sm">
          <span aria-hidden="true">📍</span>
          <span className="font-semibold text-[#1C3A2A]">{t("nur_near_to", { d: districtName(geo.code, lang) })}</span>
          <span className="rounded-full bg-[#2F6B3F]/10 px-2.5 py-0.5 text-xs font-bold text-[#24562F]">↕ {t("nearest_first")}</span>
          <button type="button" onClick={() => setPickerOpen(true)} className="text-xs font-bold text-[#2F6B3F] hover:underline">
            {t("loc_pick")} →
          </button>
        </div>
      ) : null}

      <form onSubmit={applyPin} className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          list={LOCATION_LIST_ID}
          placeholder={t("pincode")}
          aria-label={t("pincode")}
          className={`${inputCls} w-44`}
        />
        <LocationDatalist />
        <Btn type="submit">→</Btn>
        {applied ? (
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => {
              setApplied(null);
              setPin("");
            }}
          >
            {t("clear")} ✕
          </Btn>
        ) : null}
      </form>
      {pinInvalid ? <p className="mb-4 text-xs font-semibold text-rose-600">{t("invalid_pin")}</p> : null}

      {error ? (
        <div className="mb-4">
          <ErrBox>
            <p className="mb-2">{t("load_error")}</p>
            <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
              {t("retry")}
            </Btn>
          </ErrBox>
        </div>
      ) : null}

      {loading ? <Loading /> : null}

      {!loading && !error && rows.length === 0 ? <Empty emoji="🏡" title={t("empty_cat")} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((n) => {
          const etaText = etaLabel(n);
          return (
            <Link
              key={n.id}
              href={`/shop/nursery/${n.slug}`}
              className="block rounded-2xl border border-[#E4E0CE] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#EDF2E6] text-2xl" aria-hidden="true">
                    🏡
                  </span>
                  <div>
                    <p className="font-semibold text-[#20291D]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
                      {n.name}
                    </p>
                    <p className="text-xs text-[#66735F]">
                      {n.city}
                      {n.area ? ` · ${n.area}` : ""}
                    </p>
                  </div>
                </div>
                {n.physVerifiedAt ? <Pill tone="leaf">🛡️ {t("verified")}</Pill> : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#66735F]">
                <StarRow value={n.ratingAvg} />
                <span className="font-bold text-[#20291D]">{n.ratingAvg.toFixed(1)}</span>
                <span>· {t("products_count", { n: n.productCount })}</span>
              </div>
              {etaText ? (
                <div className="mt-3">
                  <Pill tone="leaf">🚚 {etaText}</Pill>
                </div>
              ) : null}
              {n.verdict ? (
                <div className="mt-3">
                  {n.verdict.delivers ? (
                    <Pill tone="leaf">🚚 {n.verdict.label}</Pill>
                  ) : (
                    <Pill tone="cream">🏪 {n.verdict.label}</Pill>
                  )}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>

      <DistrictPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
