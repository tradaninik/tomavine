"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { Btn, Card, Empty, ErrBox, Field, Loading, Pill, StarRow, catEmoji, formatDate, inr, inputCls, toast } from "../../ui";
import { displayName, useLang } from "@/lib/i18n";
import { addToCart, displayPriceOf } from "@/lib/cart";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

const CARE_ICONS: Record<string, string> = { sun: "☀️", water: "💧", soil: "🍂" };

type Variant = { id: string; label: string; price: number };

type Review = {
  id: string;
  stars: number;
  text: string;
  reply: string | null;
  createdAt: string;
  reviewer: string;
};

type Nursery = {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string | null;
  pincode: string;
  scope: string;
  scopeKm: number | null;
  ratingAvg: number;
  bulkOk: boolean;
  retailOk: boolean;
  physVerifiedAt: string | null;
};

type Product = {
  id: string;
  nameEn: string;
  names: Record<string, string> | null;
  category: string;
  botanical: string | null;
  badges: unknown;
  care: unknown;
  agri: unknown;
  provenance: unknown;
  priceMin: number;
  mrp: number;
  stock: number;
  image: string | null;
  nursery: Nursery;
  variants: Variant[];
  rescue: { pct: number; expiresAt: string } | null;
  reviews: Review[];
  avgStars: number;
  reviewCount: number;
};

type Me = { name: string | null; city: string | null; pincode: string | null } | null;

function prettyKey(k: string): string {
  const spaced = k.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function objEntries(x: unknown): [string, string | number][] {
  if (x === null || typeof x !== "object" || Array.isArray(x)) {
    return [];
  }
  const out: [string, string | number][] = [];
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number") {
      out.push([k, v]);
    }
  }
  return out;
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { lang, t } = useLang();
  const [product, setProduct] = useState<Product | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [meChecked, setMeChecked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [leadQty, setLeadQty] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadError, setLeadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setError(false);
    fetch(`/api/catalog/products/${encodeURIComponent(id)}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.ok ? res.json() : Promise.reject(new Error("failed"));
      })
      .then((data) => {
        if (active && data && data.product) {
          setProduct(data.product);
          setVariantId(data.product.variants.length > 0 ? data.product.variants[0].id : null);
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
  }, [id, reload]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setMeChecked(true);
        if (data && data.user) {
          setMe(data.user);
          if (typeof data.user.city === "string" && data.user.city.length > 0) {
            setLeadCity(data.user.city);
          }
        }
      })
      .catch(() => {
        if (active) setMeChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Display pricing (S8 Wave C): the single source in cart.ts —
  // expiry-aware, variant-aware, and identical to what checkout
  // charges. `before` is the pre-discount reference for the
  // struck-through price.
  const price = useMemo(() => {
    if (!product) {
      return { now: 0, before: 0 };
    }
    return displayPriceOf(product, variantId);
  }, [product, variantId]);

  if (loading) {
    return <Loading />;
  }

  if (notFound) {
    return (
      <Empty
        emoji="🔍"
        title="Product not found"
        text="It may have been removed or hidden by the nursery."
        action={<Btn href="/shop/category/plants">{t("browse")}</Btn>}
      />
    );
  }

  if (error || !product) {
    return (
      <ErrBox>
        <p className="mb-2">{t("load_error")}</p>
        <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
          {t("retry")}
        </Btn>
      </ErrBox>
    );
  }

  const name = displayName(product.names, lang, product.nameEn);
  const oos = product.stock <= 0;
  const isSapling = product.category === "saplings";
  const badgeList = Array.isArray(product.badges) ? product.badges.map((b) => String(b)) : [];
  const leadQtyNum = Number(leadQty);
  const leadValid =
    leadQty.trim() !== "" &&
    Number.isFinite(leadQtyNum) &&
    leadQtyNum >= 1 &&
    leadCity.trim().length >= 2 &&
    leadCompany.trim().length >= 2;

  function handleAdd() {
    const res = addToCart(product!.id, variantId, qty);
    if (res.ok) {
      setAdded(true);
      toast(`${name} · ${t("added")}`);
    } else if (res.reason) {
      toast(res.reason);
    }
  }

  async function sendLead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = Number(leadQty);
    if (!Number.isFinite(q) || q < 1) {
      return;
    }
    setSending(true);
    setLeadError("");
    try {
      const res = await fetch("/api/customer/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product!.id,
          qty: q,
          city: leadCity.trim(),
          company: leadCompany.trim(),
          notes: leadNotes.trim() === "" ? undefined : leadNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "failed");
      }
      setLeadSent(true);
    } catch {
      setLeadError(t("load_error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative flex aspect-square max-h-[380px] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#EDF2E6] via-[#F7F3E8] to-[#A9C3A0]/40">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-8xl" aria-hidden="true">
                {catEmoji(product.category)}
              </span>
            )}
            {product.rescue ? (
              <span className="absolute left-4 top-4 rounded-full bg-[#C14E2A] px-3 py-1 text-sm font-bold text-white shadow">
                🏷️ −{product.rescue.pct}%
              </span>
            ) : null}
          </div>
          <Card className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#EDF2E6] text-2xl" aria-hidden="true">
              🏡
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/shop/nursery/${product.nursery.slug}`} className="font-semibold text-[#20291D] hover:underline" style={SERIF}>
                {product.nursery.name}
              </Link>
              <p className="text-xs text-[#66735F]">
                {product.nursery.city}
                {product.nursery.area ? ` · ${product.nursery.area}` : ""}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-[#66735F]">
                <StarRow value={product.nursery.ratingAvg} />
                <span className="font-bold">{product.nursery.ratingAvg.toFixed(1)}</span>
                {product.nursery.physVerifiedAt ? <Pill tone="leaf">🛡️ {t("verified")}</Pill> : null}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div>
            {badgeList.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {badgeList.map((b) => (
                  <Pill key={b} tone="cream">
                    {b}
                  </Pill>
                ))}
              </div>
            ) : null}
            <h1 className="text-3xl font-semibold leading-tight text-[#20291D]" style={SERIF}>
              {name}
            </h1>
            {product.botanical ? (
              <p className="mt-1 text-sm italic text-[#8E9A84]" style={SERIF}>
                {product.botanical}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-2 text-sm text-[#66735F]">
              <StarRow value={product.avgStars} />
              <span className="font-bold text-[#20291D]">{product.avgStars > 0 ? product.avgStars.toFixed(1) : "—"}</span>
              <span>· {product.reviewCount} {t("reviews")}</span>
            </div>
          </div>

          {product.rescue ? (
            <div className="rounded-2xl border border-[#C14E2A]/30 bg-[#F9E4DB] p-4">
              <p className="text-sm font-bold text-[#8F3517]">
                🏷️ Discount −{product.rescue.pct}% · {t("rescue_ends")} {formatDate(product.rescue.expiresAt)}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold text-[#1C3A2A]">{inr(price.now)}</span>
            {price.before > price.now ? (
              <span className="text-sm text-[#8E9A84] line-through">{inr(price.before)}</span>
            ) : product.mrp > price.now ? (
              <span className="text-sm text-[#8E9A84] line-through">{inr(product.mrp)}</span>
            ) : null}
            {oos ? (
              <Pill tone="rose">{t("out_of_stock")}</Pill>
            ) : product.stock <= 5 ? (
              <Pill tone="amber">{t("only_left", { n: product.stock })}</Pill>
            ) : (
              <Pill tone="leaf">{t("in_stock")}</Pill>
            )}
          </div>

          {product.variants.length > 0 ? (
            <div className="space-y-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={
                    variantId === v.id
                      ? "flex w-full items-center gap-3 rounded-2xl border-2 border-[#2F6B3F] bg-[#EDF2E6] px-4 py-3 text-left"
                      : "flex w-full items-center gap-3 rounded-2xl border border-[#D6D2BC] bg-white px-4 py-3 text-left transition hover:border-[#2F6B3F]/50"
                  }
                >
                  <span className={variantId === v.id ? "h-4 w-4 rounded-full border-[5px] border-[#2F6B3F]" : "h-4 w-4 rounded-full border-2 border-[#D6D2BC]"} />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-[#20291D]">{v.label}</span>
                  <span className="text-sm font-bold text-[#1C3A2A]">{inr(displayPriceOf(product, v.id).now)}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-[#D6D2BC] bg-white">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-10 text-lg font-bold text-[#1C3A2A]">
                −
              </button>
              <span className="w-10 text-center text-sm font-bold text-[#1C3A2A]">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(50, q + 1))} className="h-10 w-10 text-lg font-bold text-[#1C3A2A]">
                +
              </button>
            </div>
            <Btn onClick={handleAdd} disabled={oos} size="lg">
              🛒 {t("add_to_cart")}
            </Btn>
            {added ? (
              <Btn href="/shop/cart" variant="outline" size="lg">
                {t("go_to_cart")} →
              </Btn>
            ) : null}
          </div>
        </div>
      </div>

      {isSapling && product.agri ? (
        <div className="rounded-3xl bg-[#1C3A2A] p-6 text-[#F7F3E8]">
          <h2 className="text-lg font-semibold" style={SERIF}>
            🌾 {t("per_acre")}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {objEntries(product.agri).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#A9C3A0]">{prettyKey(k)}</p>
                <p className="mt-0.5 text-sm font-semibold">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {objEntries(product.care).length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
            🌿 {t("care")}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {objEntries(product.care).map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-[#E4E0CE] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#5F7A58]">
                  {CARE_ICONS[k] ?? "🌿"} {prettyKey(k)}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#20291D]">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {objEntries(product.provenance).length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
            📍 {t("origin")}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {objEntries(product.provenance).map(([k, v]) => (
              <span key={k} className="rounded-2xl bg-[#F7F3E8] px-4 py-2 text-sm">
                <span className="text-xs font-bold text-[#5F7A58]">{prettyKey(k)}: </span>
                <span className="font-semibold text-[#20291D]">{v}</span>
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-[#20291D]" style={SERIF}>
            ⭐ {t("reviews")}
          </h2>
          <span className="flex items-center gap-2 text-sm text-[#66735F]">
            <StarRow value={product.avgStars} />
            <span className="font-bold text-[#20291D]">{product.avgStars.toFixed(1)}</span>
          </span>
        </div>
        {product.reviews.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#D6D2BC] p-6 text-center text-sm text-[#66735F]">{t("no_reviews")}</p>
        ) : (
          <div className="space-y-3">
            {product.reviews.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#EDF2E6] text-sm font-bold text-[#24562F]">
                    {r.reviewer.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#20291D]">{r.reviewer}</p>
                    <p className="text-xs text-[#8E9A84]">{formatDate(r.createdAt)}</p>
                  </div>
                  <StarRow value={r.stars} className="ml-auto" />
                </div>
                <p className="mt-3 text-sm text-[#20291D]">{r.text}</p>
                {r.reply ? (
                  <div className="mt-3 rounded-2xl bg-[#EDF2E6] p-4 text-sm">
                    <p className="text-xs font-bold text-[#24562F]">🏡 {t("nursery_reply")}</p>
                    <p className="mt-1 text-[#20291D]">{r.reply}</p>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>

      {product.nursery.bulkOk ? (
        <Card className="border-[#2F6B3F]/30 bg-[#EDF2E6]/60">
          <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
            🚜 {t("bulk_enquiry")}
          </h2>
          <p className="mt-1 text-sm text-[#66735F]">{t("enquiry_s")}</p>
          {leadSent ? (
            <div className="mt-4 rounded-2xl border border-[#2F6B3F]/30 bg-white p-4 text-sm font-semibold text-[#24562F]">
              ✅ {t("enquiry_sent")}
            </div>
          ) : meChecked && !me ? (
            <div className="mt-4">
              <Btn href="/login">{t("login_to_enquire")}</Btn>
            </div>
          ) : meChecked && me ? (
            <form onSubmit={sendLead} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={t("qty_needed")}>
                <input
                  className={inputCls}
                  type="number"
                  min={1}
                  value={leadQty}
                  onChange={(e) => setLeadQty(e.target.value)}
                  placeholder="5000"
                />
              </Field>
              <Field label={t("city_label")}>
                <input className={inputCls} value={leadCity} onChange={(e) => setLeadCity(e.target.value)} placeholder="Bengaluru" />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("company")}>
                  <input
                    className={inputCls}
                    value={leadCompany}
                    onChange={(e) => setLeadCompany(e.target.value)}
                    placeholder="Sunrise Agro Farms"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("notes_opt")}>
                  <textarea className={inputCls} rows={3} value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} />
                </Field>
              </div>
              {leadError ? (
                <div className="sm:col-span-2">
                  <ErrBox>{leadError}</ErrBox>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Btn type="submit" disabled={sending || !leadValid}>
                  {sending ? "…" : t("send_enquiry")}
                </Btn>
              </div>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}