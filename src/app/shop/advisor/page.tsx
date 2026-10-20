"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill, ProductThumb, SectionTitle, inr, inputCls } from "../ui";
import { displayName, useLang } from "@/lib/i18n";
import { displayPriceOf } from "@/lib/cart";
import { SOIL_CHOICES, type SoilChoice } from "@/lib/advisor";

type Item = {
  id: string; nameEn: string; names: unknown; category: string; priceMin: number; mrp: number;
  stock: number; image: string | null; care: unknown;
  variants: { id: string; price: number }[];
  rescue: { pct: number; expiresAt: string } | null;
  nursery: { name: string; slug: string; city: string };
  reasons: { season: string | null; soil: boolean; near: boolean };
};

type Result = { month: number; seasons: string[]; plantNow: Item[]; later: Item[] };

const SOIL_LABELS: Record<SoilChoice, string> = {
  loamy: "Loamy", sandy: "Sandy", clay: "Clay", black: "Black", red: "Red", unsure: "Not sure",
};

const monthLabel = (m: number) => new Date(2024, m - 1, 1).toLocaleString("en-IN", { month: "long" });

function ResultCard({ it, lang, later }: { it: Item; lang: Parameters<typeof displayName>[1]; later: boolean }) {
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
            {it.nursery.name} · {it.nursery.city}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {it.reasons.season === "all-year" ? <Pill tone="leaf">Grows year-round</Pill> : null}
            {it.reasons.season && it.reasons.season !== "all-year" ? (
              <Pill tone="leaf">{later ? `Best in ${it.reasons.season}` : `Sows in ${it.reasons.season}`}</Pill>
            ) : null}
            {it.reasons.soil ? <Pill tone="amber">Suits your soil</Pill> : null}
            {it.reasons.near ? <Pill tone="sky">Nursery near you</Pill> : null}
            {it.stock === 0 ? <Pill tone="rose">Out of stock</Pill> : null}
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

export default function AdvisorPage() {
  const { lang } = useLang();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [soil, setSoil] = useState<SoilChoice>("unsure");
  const [city, setCity] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async (m: number, s: SoilChoice, c: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/advisor?month=${m}&soil=${s}&city=${encodeURIComponent(c)}`);
      if (res.ok) setResult(await res.json());
    } catch {
      /* keep last result */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.user && typeof d.user.city === "string" && d.user.city) {
          setCity(d.user.city);
          run(new Date().getMonth() + 1, "unsure", d.user.city);
        }
      })
      .catch(() => undefined);
    run(new Date().getMonth() + 1, "unsure", "");
  }, [run]);

  return (
    <div>
      <SectionTitle>🌱 Planting advisor</SectionTitle>
      <p className="mt-1 text-sm text-[#66735F]">
        What can you plant this month, in your soil, from nurseries near you?
      </p>

      <Card className="mt-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-[#1C3A2A]">
            Month
            <select
              className={`${inputCls} mt-1`}
              value={month}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonth(m);
                run(m, soil, city);
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#1C3A2A]">
            Your soil
            <select
              className={`${inputCls} mt-1`}
              value={soil}
              onChange={(e) => {
                const s = e.target.value as SoilChoice;
                setSoil(s);
                run(month, s, city);
              }}
            >
              {SOIL_CHOICES.map((s) => (
                <option key={s} value={s}>{SOIL_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#1C3A2A]">
            City
            <div className="mt-1 flex gap-2">
              <input
                className={inputCls}
                value={city}
                maxLength={60}
                placeholder="e.g. Hyderabad"
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") run(month, soil, city);
                }}
              />
              <Btn onClick={() => run(month, soil, city)} disabled={loading}>
                Go
              </Btn>
            </div>
          </label>
        </div>
        {result ? (
          <p className="mt-3 text-xs text-[#66735F]">
            {monthLabel(result.month)} is {result.seasons.length > 0 ? result.seasons.join(" · ") : "a transition"} season.
          </p>
        ) : null}
      </Card>

      {loading && result === null ? <p className="mt-4 text-[#1C3A2A]/60">Loading…</p> : null}

      {result ? (
        <div className="mt-4 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-[#20291D]">
              Plant now — {monthLabel(result.month)} ({result.plantNow.length})
            </h2>
            <div className="mt-3 space-y-3">
              {result.plantNow.length === 0 ? (
                <p className="text-sm text-[#1C3A2A]/60">No matches yet — try another month or soil.</p>
              ) : (
                result.plantNow.map((it) => <ResultCard key={it.id} it={it} lang={lang} later={false} />)
              )}
            </div>
          </section>

          {result.later.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold text-[#20291D]">
                Better in other months ({result.later.length})
              </h2>
              <div className="mt-3 space-y-3">
                {result.later.map((it) => <ResultCard key={it.id} it={it} lang={lang} later={true} />)}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}