"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Btn, Card, Pill, ProductThumb, SectionTitle, inr, inputCls } from "../ui";
import { displayName, useLang } from "@/lib/i18n";
import { displayPriceOf } from "@/lib/cart";
import { LIGHT_CHOICES, SOIL_CHOICES, lightOf, type LightChoice, type SoilChoice } from "@/lib/advisor";
import { LOCATION_LIST_ID, LocationDatalist } from "@/lib/location-options";

// ADVR: two-track wizard - home -> garden | farm -> results. Pure
// client state machine, the URL stays /shop/advisor. The garden
// track sends light= and the farm track sends cat= (both opt-in at
// the API: absent or invalid means no filter); acreage chips are
// display-only and never leave the page. Every UI string comes from
// the advr_* keys wired into i18n by advr-2.ps1; tf() fills the
// {placeholders} those keys carry.

type Item = {
  id: string; nameEn: string; names: unknown; category: string; priceMin: number; mrp: number;
  stock: number; image: string | null; care: unknown;
  variants: { id: string; price: number }[];
  rescue: { pct: number; expiresAt: string } | null;
  nursery: { name: string; slug: string; city: string };
  reasons: { season: string | null; soil: boolean; light: boolean | null; near: boolean; locLabel: string | null };
};

type Result = {
  month: number;
  seasons: string[];
  light: string | null;
  cat: string | null;
  plantNow: Item[];
  later: Item[];
  location?: { echo: string | null } | null;
};

type View = "home" | "garden" | "farm" | "results";
type Track = "garden" | "farm";
type SpaceChoice = "balcony" | "terrace" | "indoor" | "kitchen";
type Tf = (key: string, vars?: Record<string, string | number>) => string;
type LightFilter = LightChoice | "all";

// Space sets a light guess (advr_space_hint); the user can override it.
const SPACE_CHOICES: SpaceChoice[] = ["balcony", "terrace", "indoor", "kitchen"];
const SPACE_LIGHT: Record<SpaceChoice, LightChoice> = {
  balcony: "partial",
  terrace: "sun",
  indoor: "shade",
  kitchen: "sun",
};
const SPACE_KEY: Record<SpaceChoice, string> = {
  balcony: "advr_space_balcony",
  terrace: "advr_space_terrace",
  indoor: "advr_space_indoor",
  kitchen: "advr_space_kitchen",
};

const LIGHT_KEY: Record<LightChoice, string> = {
  sun: "advr_light_full",
  partial: "advr_light_partial",
  shade: "advr_light_low",
};

const LIGHT_FILTERS: LightFilter[] = ["all", "sun", "partial", "shade"];

const SOIL_KEY: Record<SoilChoice, string> = {
  loamy: "advr_soil_loamy",
  sandy: "advr_soil_sandy",
  clay: "advr_soil_clay",
  black: "advr_soil_black",
  red: "advr_soil_red",
  unsure: "advr_soil_unsure",
};

// Farm acreage: display-only chips, never sent to the API.
const ACREAGE: { v: string; key: string }[] = [
  { v: "a1", key: "advr_acre_1" },
  { v: "a2", key: "advr_acre_2" },
  { v: "a3", key: "advr_acre_3" },
];

// Farm crop chips -> the cat= filter. "all" sends nothing. Values
// are a subset of ADVISOR_CATS in src/lib/advisor.ts; the API
// re-validates anything it receives.
const CROPS: { v: string; key: string }[] = [
  { v: "all", key: "advr_crop_all" },
  { v: "saplings", key: "advr_crop_saplings" },
  { v: "seeds", key: "advr_crop_seeds" },
  { v: "inputs", key: "advr_crop_inputs" },
  { v: "tools", key: "advr_crop_tools" },
];

const monthLabel = (m: number) => new Date(2024, m - 1, 1).toLocaleString("en-IN", { month: "long" });

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "rounded-full border border-[#2F6B3F] bg-[#2F6B3F] px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-full border border-[#1C3A2A]/20 bg-white px-3 py-1.5 text-sm font-medium text-[#1C3A2A] hover:border-[#2F6B3F]/60"
      }
    >
      {children}
    </button>
  );
}

function ResultCard({ it, lang, later, showLight, tf }: { it: Item; lang: Parameters<typeof displayName>[1]; later: boolean; showLight: boolean; tf: Tf }) {
  const dp = displayPriceOf(it, null);
  return (
    <Card>
      <div className="flex gap-3">
        <ProductThumb category={it.category} image={it.image} size="md" />
        <div className="min-w-0 flex-1">
          <Link href={`/shop/product/${it.id}`} className="line-clamp-2 text-sm font-semibold text-[#20291D] hover:underline">
            {displayName(it.names, lang, it.nameEn)}
          </Link>
          <p className="truncate text-xs text-[#66735F]">
            {it.nursery.name} {"\u00b7"} {it.nursery.city}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {it.reasons.season === "all-year" ? <Pill tone="leaf">{tf("advr_pill_year")}</Pill> : null}
            {it.reasons.season && it.reasons.season !== "all-year" ? (
              <Pill tone="leaf">{tf(later ? "advr_pill_best" : "advr_pill_sow", { season: it.reasons.season })}</Pill>
            ) : null}
            {it.reasons.soil ? <Pill tone="amber">{tf("advr_pill_soil")}</Pill> : null}
            {showLight && it.reasons.light === true ? <Pill tone="sky">{tf("advr_pill_light")}</Pill> : null}
            {it.reasons.locLabel ? <Pill tone="sky">{it.reasons.locLabel}</Pill> : null}
            {it.stock === 0 ? <Pill tone="rose">{tf("advr_pill_stock")}</Pill> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-[#1C3A2A]">{inr(dp.now)}</p>
          {dp.before > dp.now ? <p className="text-xs text-[#8E9A84] line-through">{inr(dp.before)}</p> : null}
        </div>
      </div>
    </Card>
  );
}

// Nurseries near you: distinct nurseries among this month's matches,
// ranked by how many matches they carry, linking to their storefront.
function NurseryStrip({ items, tf }: { items: Item[]; tf: Tf }) {
  const bySlug = new Map<string, { slug: string; name: string; city: string; count: number; min: number; order: number }>();
  items.forEach((it, i) => {
    const price = displayPriceOf(it, null).now;
    const hit = bySlug.get(it.nursery.slug);
    if (hit) {
      hit.count += 1;
      if (price < hit.min) hit.min = price;
    } else {
      bySlug.set(it.nursery.slug, { slug: it.nursery.slug, name: it.nursery.name, city: it.nursery.city, count: 1, min: price, order: i });
    }
  });
  const list = [...bySlug.values()].sort((a, b) => b.count - a.count || a.order - b.order).slice(0, 6);
  if (list.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-[#20291D]">{tf("advr_nurseries_near", { n: list.length })}</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((n) => (
          <Link
            key={n.slug}
            href={`/shop/nursery/${n.slug}`}
            className="block rounded-2xl border border-[#1C3A2A]/10 bg-white p-4 hover:border-[#2F6B3F]/60"
          >
            <p className="text-sm font-semibold text-[#20291D]">{n.name}</p>
            <p className="truncate text-xs text-[#66735F]">{n.city}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone="leaf">{tf("advr_nursery_matches", { n: n.count })}</Pill>
              <span className="text-xs text-[#66735F]">{tf("advr_from_price", { price: inr(n.min) })}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function AdvisorPage() {
  const { lang, t } = useLang();
  const tf: Tf = (key, vars) => {
    let s = t(key);
    if (vars) for (const name of Object.keys(vars)) s = s.split(`{${name}}`).join(String(vars[name]));
    return s;
  };

  const [view, setView] = useState<View>("home");
  const [track, setTrack] = useState<Track>("garden");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [soil, setSoil] = useState<SoilChoice>("unsure");
  const [city, setCity] = useState("");
  const [space, setSpace] = useState<SpaceChoice>("balcony");
  const [light, setLight] = useState<LightChoice>("partial");
  const [acreage, setAcreage] = useState("a1");
  const [crop, setCrop] = useState("all");
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<LightFilter>("all");
  const [loading, setLoading] = useState(false);

  // S6-D: a saved pincode pins the results best; city is the fallback.
  // The wizard starts at home - this only prefills the location box.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.user) {
          const pin = typeof d.user.pincode === "string" && /^[1-9]\d{5}$/.test(d.user.pincode) ? d.user.pincode : "";
          const town = typeof d.user.city === "string" && d.user.city ? d.user.city : "";
          const pref = pin || town;
          if (pref) setCity(pref);
        }
      })
      .catch(() => undefined);
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("month", String(month));
      q.set("soil", soil);
      q.set("loc", city);
      if (track === "garden") q.set("light", light);
      if (track === "farm" && crop !== "all") q.set("cat", crop);
      const res = await fetch(`/api/advisor?${q.toString()}`);
      if (res.ok) {
        setResult(await res.json());
        setView("results");
        setFilter(track === "garden" ? light : "all");
      }
    } catch {
      /* keep last result */
    }
    setLoading(false);
  };

  if (view === "home") {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#2F6B3F]">{t("advr_hero_eyebrow")}</p>
        <SectionTitle>{t("advr_hero_t")}</SectionTitle>
        <p className="mt-1 text-sm text-[#66735F]">{t("advr_hero_s")}</p>
        <p className="mt-1 text-xs text-[#66735F]">{t("legal_advisor_note")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <button type="button" className="w-full text-left transition hover:opacity-90" onClick={() => { setTrack("garden"); setView("garden"); }}>
            <Card className="h-full">
              <p className="text-base font-semibold text-[#20291D]">{t("advr_track_garden_t")}</p>
              <p className="mt-1 text-sm text-[#66735F]">{t("advr_track_garden_s")}</p>
            </Card>
          </button>
          <button type="button" className="w-full text-left transition hover:opacity-90" onClick={() => { setTrack("farm"); setView("farm"); }}>
            <Card className="h-full">
              <p className="text-base font-semibold text-[#20291D]">{t("advr_track_farm_t")}</p>
              <p className="mt-1 text-sm text-[#66735F]">{t("advr_track_farm_s")}</p>
            </Card>
          </button>
        </div>
      </div>
    );
  }

  if (view === "garden" || view === "farm") {
    const garden = view === "garden";
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>{garden ? t("advr_your_space") : t("advr_your_farm")}</SectionTitle>
          <button type="button" onClick={() => setView("home")} className="text-sm font-medium text-[#2F6B3F] hover:underline">
            {t("advr_back")}
          </button>
        </div>
        <Card className="mt-4">
          <div className="space-y-4">
            {garden ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {SPACE_CHOICES.map((s) => (
                    <Chip key={s} on={space === s} onClick={() => { setSpace(s); setLight(SPACE_LIGHT[s]); }}>
                      {t(SPACE_KEY[s])}
                    </Chip>
                  ))}
                </div>
                <p className="text-xs text-[#8E9A84]">{t("advr_space_hint")}</p>
                <div>
                  <p className="text-sm font-medium text-[#1C3A2A]">{t("advr_light_label")}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {LIGHT_CHOICES.map((l) => (
                      <Chip key={l} on={light === l} onClick={() => setLight(l)}>
                        {t(LIGHT_KEY[l])}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-[#1C3A2A]">{t("advr_acreage_label")}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {ACREAGE.map((a) => (
                      <Chip key={a.v} on={acreage === a.v} onClick={() => setAcreage(a.v)}>
                        {t(a.key)}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1C3A2A]">{t("advr_crop_label")}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {CROPS.map((c) => (
                      <Chip key={c.v} on={crop === c.v} onClick={() => setCrop(c.v)}>
                        {t(c.key)}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-[#1C3A2A]">
                {t("advr_month")}
                <select
                  className={`${inputCls} mt-1`}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-[#1C3A2A]">
                {t("advr_soil")}
                <select
                  className={`${inputCls} mt-1`}
                  value={soil}
                  onChange={(e) => setSoil(e.target.value as SoilChoice)}
                >
                  {SOIL_CHOICES.map((s) => (
                    <option key={s} value={s}>{t(SOIL_KEY[s])}</option>
                  ))}
                </select>
              </label>
              <div className="text-sm font-medium text-[#1C3A2A]">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={city}
                    maxLength={60}
                    list={LOCATION_LIST_ID}
                    placeholder={t("advr_loc_ph")}
                    onChange={(e) => setCity(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") run(); }}
                  />
                  <Btn onClick={() => run()} disabled={loading}>{t("advr_go")}</Btn>
                </div>
                <span className="mt-1 block text-xs font-normal text-[#8E9A84]">{t("advr_loc_hint")}</span>
              </div>
            </div>
          </div>
          <LocationDatalist />
          <div className="mt-4 flex justify-end">
            <Btn onClick={() => run()} disabled={loading}>
              {loading ? t("advr_loading") : t("advr_show_matches")}
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  const garden = track === "garden";
  const showLight = result !== null && result.light !== null;
  const keep = (it: Item): boolean => {
    if (filter === "all") return true;
    const need = lightOf(it.care);
    return need !== null && need.includes(filter);
  };
  const nowList = result === null ? [] : result.plantNow.filter(keep);
  const laterList = result === null ? [] : result.later.filter(keep);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>{garden ? t("advr_your_space") : t("advr_your_farm")}</SectionTitle>
        <button type="button" onClick={() => setView(track)} className="text-sm font-medium text-[#2F6B3F] hover:underline">
          {t("advr_change_answers")}
        </button>
      </div>
      <p className="mt-1 text-xs text-[#66735F]">{t("legal_advisor_note")}</p>

      {result && result.location && result.location.echo ? (
        <p className="mt-2 text-xs font-medium text-[#2F6B3F]">{tf("advr_echo_line", { echo: result.location.echo })}</p>
      ) : null}
      {result ? (
        <p className="mt-1 text-sm text-[#66735F]">
          {tf("advr_season_line", {
            month: monthLabel(result.month),
            seasons: result.seasons.length > 0 ? result.seasons.join(" \u00b7 ") : t("advr_season_none"),
          })}
        </p>
      ) : null}

      {garden && result ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#1C3A2A]">{t("advr_filter_label")}</span>
          {LIGHT_FILTERS.map((f) => (
            <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? t("advr_filter_all") : t(LIGHT_KEY[f])}
            </Chip>
          ))}
        </div>
      ) : null}

      {loading && result === null ? <p className="mt-4 text-[#1C3A2A]/60">{t("advr_loading")}</p> : null}

      {result ? (
        <div className="mt-4 space-y-6">
          <NurseryStrip items={nowList} tf={tf} />
          <section>
            <h2 className="text-lg font-semibold text-[#20291D]">
              {tf("advr_results_now", { month: monthLabel(result.month), n: nowList.length })}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nowList.length === 0 ? (
                <p className="text-sm text-[#1C3A2A]/60">{filter === "all" ? t("advr_results_none") : t("advr_filter_none")}</p>
              ) : (
                nowList.map((it) => (
                  <ResultCard key={it.id} it={it} lang={lang} later={false} showLight={showLight} tf={tf} />
                ))
              )}
            </div>
          </section>
          {laterList.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold text-[#20291D]">{tf("advr_results_later", { n: laterList.length })}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {laterList.map((it) => (
                  <ResultCard key={it.id} it={it} lang={lang} later={true} showLight={showLight} tf={tf} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
