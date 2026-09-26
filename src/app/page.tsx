"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Fraunces, Karla } from "next/font/google";
import { LangPill, LangProvider, useLang } from "@/lib/i18n";
import { Btn, ProductTile, StarRow } from "@/app/shop/ui";
import type { ProductCard } from "@/lib/catalog";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], variable: "--font-body" });

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

const CATS = [
  { href: "/shop/category/saplings", key: "saplings", emoji: "🌾" },
  { href: "/shop/category/plants", key: "plants", emoji: "🪴" },
  { href: "/shop/category/inputs", key: "inputs", emoji: "🧪" },
  { href: "/shop/category/pots", key: "pots", emoji: "🏺" },
  { href: "/shop/category/tools", key: "tools", emoji: "🛠️" },
];

type NurseryCard = {
  id: string;
  name: string;
  slug: string;
  city: string;
  ratingAvg: number;
  productCount: number;
};

type NavUser = {
  name: string | null;
  phone: string;
  role: string;
};

function Landing() {
  const { t } = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [nurseries, setNurseries] = useState<NurseryCard[]>([]);
  const [user, setUser] = useState<NavUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/catalog/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.products)) {
          setProducts(data.products.slice(0, 8));
        }
      })
      .catch(() => undefined);
    fetch("/api/catalog/nurseries")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.nurseries)) {
          setNurseries(data.nurseries.slice(0, 4));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function submitSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const s = q.trim();
    if (s.length > 0) {
      router.push(`/shop/search?q=${encodeURIComponent(s)}`);
    }
  }

  async function logout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors — clear local state regardless
    }
    setUser(null);
    setLoggingOut(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F3E8]" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <header className="sticky top-0 z-40 border-b border-[#E4E0CE] bg-[#F7F3E8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1C3A2A] text-lg" aria-hidden="true">
              🌱
            </span>
            <span className="text-xl font-semibold text-[#1C3A2A]" style={SERIF}>
              Tomavine
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LangPill />
            {user ? (
              <>
                <Link href="/shop/orders" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#1C3A2A]/80 hover:bg-[#2F6B3F]/10 sm:block">
                  {t("my_orders")}
                </Link>
                {user.role === "ADMIN" ? (
                  <Link href="/admin" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#24562F] hover:bg-[#2F6B3F]/10 sm:block">
                    {t("admin")}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="rounded-xl border border-[#D6D2BC] bg-white px-3 py-2 text-sm font-semibold text-[#66735F] transition hover:border-[#C14E2A] hover:text-[#C14E2A] disabled:opacity-50"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <Link href="/login" className="rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24562F]">
                {t("login")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#EDF2E6] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#2F6B3F]">
            <span aria-hidden="true">🌿</span> {t("hero_eyebrow")}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-[#20291D] sm:text-5xl" style={SERIF}>
            {t("hero_t")}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[#66735F] sm:text-lg">{t("hero_s")}</p>

          <form onSubmit={submitSearch} className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-[#D6D2BC] bg-white p-2 pl-4 shadow-sm">
            <span aria-hidden="true" className="text-[#8E9A84]">
              🔍
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search_ph")}
              aria-label={t("search_ph")}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
            />
            <Btn type="submit" size="sm">
              →
            </Btn>
          </form>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#66735F]">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">🛡️</span> {t("trust_verified")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">💵</span> {t("trust_cod")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">🚚</span> {t("trust_delivery")}
            </span>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="text-xl font-semibold text-[#20291D] sm:text-2xl" style={SERIF}>
            {t("shop_by_category")}
          </h2>
          <div className="mt-5 flex flex-wrap gap-3 sm:gap-5">
            {CATS.map((c) => (
              <Link key={c.key} href={c.href} className="group flex w-20 flex-col items-center gap-2 text-center sm:w-24">
                <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-[#D6D2BC] bg-white text-2xl transition group-hover:-translate-y-1 group-hover:border-[#2F6B3F] sm:h-20 sm:w-20 sm:text-3xl" aria-hidden="true">
                  {c.emoji}
                </span>
                <span className="text-xs font-bold text-[#66735F] group-hover:text-[#1C3A2A]">{t(c.key)}</span>
              </Link>
            ))}
          </div>
        </section>

        {products.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-5 flex items-end justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#20291D] sm:text-2xl" style={SERIF}>
                {t("fresh")}
              </h2>
              <Link href="/shop/category/plants" className="text-sm font-bold text-[#2F6B3F] hover:underline">
                {t("view_all")} →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductTile key={p.id} p={p} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#1C3A2A] p-8 text-[#F7F3E8]">
            <div>
              <p className="text-2xl font-semibold" style={SERIF}>
                🏷️ {t("rescue")}
              </p>
              <p className="mt-2 max-w-lg text-sm text-[#F7F3E8]/70">{t("rescue_pitch")}</p>
            </div>
            <Btn href="/shop/rescue" size="lg">
              {t("rescue")} →
            </Btn>
          </div>
        </section>

        {nurseries.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 py-8">
            <h2 className="text-xl font-semibold text-[#20291D] sm:text-2xl" style={SERIF}>
              {t("featured")}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {nurseries.map((n) => (
                <Link
                  key={n.id}
                  href={`/shop/nursery/${n.slug}`}
                  className="rounded-2xl border border-[#E4E0CE] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EDF2E6] text-2xl" aria-hidden="true">
                      🏡
                    </span>
                    <div>
                      <p className="font-semibold text-[#20291D]" style={SERIF}>
                        {n.name}
                      </p>
                      <p className="text-xs text-[#66735F]">{n.city}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#66735F]">
                    <StarRow value={n.ratingAvg} />
                    <span className="font-bold text-[#20291D]">{n.ratingAvg.toFixed(1)}</span>
                    <span>· {t("products_count", { n: n.productCount })}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-3xl bg-[#EDF2E6] p-8 sm:p-10">
            <h2 className="max-w-2xl text-xl font-semibold text-[#20291D] sm:text-2xl" style={SERIF}>
              {t("sell_title")}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-[#66735F]">{t("sell_s")}</p>
            <Btn href="/sell" size="lg" className="mt-6">
              {t("list_your_nursery")}
            </Btn>
          </div>
        </section>
      </main>

      <footer className="mt-10 bg-[#1C3A2A] px-4 py-10 text-center text-sm text-[#F7F3E8]/60">
        <p className="text-base font-semibold text-[#F7F3E8]" style={SERIF}>
          🌱 Tomavine
        </p>
        <p className="mt-1">Where growers meet gardens</p>
        <p className="mt-1 text-xs">Cash on delivery · From physically verified nurseries</p>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <LangProvider>
        <Landing />
      </LangProvider>
    </div>
  );
}