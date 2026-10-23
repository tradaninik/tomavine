"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Fraunces, Karla } from "next/font/google";
import { LangPill, LangProvider, useLang } from "@/lib/i18n";
import { Btn, ProductTile, StarRow, ToastHost } from "@/app/shop/ui";
import { LocationChip } from "@/app/shop/location";
import { CART_EVENT, cartCount, loadCart } from "@/lib/cart";
import type { ProductCard } from "@/lib/catalog";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], variable: "--font-body" });

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

const CATS = [
  { href: "/shop/category/saplings", key: "saplings", emoji: "🌾", img: "/photos/cat-saplings.jpg" },
  { href: "/shop/category/plants", key: "plants", emoji: "🪴", img: "/photos/cat-plants.jpg" },
  { href: "/shop/category/inputs", key: "inputs", emoji: "🧪", img: "/photos/cat-inputs.jpg" },
  { href: "/shop/category/pots", key: "pots", emoji: "🏺", img: "/photos/cat-pots.jpg" },
  { href: "/shop/category/tools", key: "tools", emoji: "🛠️", img: "/photos/cat-tools.jpg" },
];

type NurseryCard = {
  id: string;
  name: string;
  slug: string;
  city: string;
  ratingAvg: number;
  productCount: number;
  image: string | null;
};

type Stats = {
  nurseries: number;
  listings: number;
  categories: number;
  rescue: number;
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [user, setUser] = useState<NavUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [cartN, setCartN] = useState(0);

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
    fetch("/api/catalog/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.nurseries === "number") {
          setStats(data);
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

  useEffect(() => {
    const refresh = () => setCartN(cartCount(loadCart()));
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    return () => window.removeEventListener(CART_EVENT, refresh);
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

  const statCells = [
    { value: stats ? stats.nurseries : null, label: t("stats_nurseries", { n: stats ? stats.nurseries : 0 }) },
    { value: stats ? stats.listings : null, label: t("stats_listings", { n: stats ? stats.listings : 0 }) },
    { value: stats ? stats.categories : null, label: t("stats_categories") },
    { value: stats ? stats.rescue : null, label: t("stats_rescue", { n: stats ? stats.rescue : 0 }) },
  ];

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
            <LocationChip />
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
            <Link
              href="/shop/cart"
              className="relative inline-flex items-center gap-2 rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24562F]"
            >
              <span aria-hidden="true">🛒</span>
              <span className="hidden sm:inline">{t("cart")}</span>
              {cartN > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E39B2D] px-1 text-xs font-bold text-[#1C3A2A]">
                  {cartN}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero: copy + search on the left, photo collage on the right ── */}
        <section className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16 lg:pb-6 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[#EDF2E6] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#2F6B3F]">
                <span aria-hidden="true">🌿</span> {t("hero_eyebrow")}
              </p>
              <h1 className="mt-5 max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight text-[#20291D] sm:text-5xl" style={SERIF}>
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
            </div>

            <div className="relative mx-auto w-full max-w-md pb-10 lg:max-w-none lg:pb-8">
              <img
                src="/photos/hero-terrace.jpg"
                alt="Terrace garden with grow bags full of vegetables"
                className="aspect-[4/3] w-full rounded-3xl object-cover shadow-xl"
              />
              <img
                src="/photos/hero-farm.jpg"
                alt="Farmer planting seedlings in a field"
                className="absolute -top-6 -right-3 hidden w-36 rotate-3 rounded-2xl border-4 border-white object-cover shadow-lg sm:block lg:-right-6 lg:w-44"
              />
              <img
                src="/photos/nursery-green-leaf.jpg"
                alt="Verified plant nursery with rows of flowering plants"
                className="absolute -bottom-2 -left-3 hidden w-40 -rotate-2 rounded-2xl border-4 border-white object-cover shadow-lg sm:block lg:-left-8 lg:w-48"
              />
              <div className="absolute right-4 -bottom-1 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:right-6 lg:-bottom-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EDF2E6] text-lg" aria-hidden="true">
                  🛡️
                </span>
                <div>
                  <p className="text-sm font-bold text-[#20291D]">{t("hero_badge")}</p>
                  {nurseries.length > 0 ? (
                    <p className="inline-flex items-center gap-1.5 text-xs text-[#66735F]">
                      <StarRow value={nurseries.reduce((s, n) => s + n.ratingAvg, 0) / nurseries.length} />
                      <span className="font-bold text-[#20291D]">
                        {(nurseries.reduce((s, n) => s + n.ratingAvg, 0) / nurseries.length).toFixed(1)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats band ── */}
        <section className="mx-auto max-w-6xl px-4 pt-12 sm:pt-14">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-[#1C3A2A] shadow-sm sm:grid-cols-4">
            {statCells.map((s, i) => (
              <div key={i} className="bg-[#224731] px-4 py-6 text-center">
                <p className="text-3xl font-semibold text-[#F7F3E8]" style={SERIF}>
                  {s.value === null ? "—" : s.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#F7F3E8]/70">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Categories ── */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-semibold text-[#20291D] sm:text-2xl" style={SERIF}>
            {t("shop_by_category")}
          </h2>
          <div className="mt-5 flex flex-wrap gap-4 sm:gap-7">
            {CATS.map((c) => (
              <Link key={c.key} href={c.href} className="group flex w-20 flex-col items-center gap-2 text-center sm:w-24">
                <span className="h-16 w-16 overflow-hidden rounded-full border-2 border-[#D6D2BC] bg-white transition group-hover:-translate-y-1 group-hover:border-[#2F6B3F] sm:h-20 sm:w-20">
                  <img src={c.img} alt={t(c.key)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
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
                  className="rounded-2xl border border-[#E4E0CE] bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  {n.image ? (
                    <div className="h-28 overflow-hidden rounded-xl">
                      <img src={n.image} alt={n.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="grid h-28 place-items-center rounded-xl bg-[#EDF2E6] text-4xl" aria-hidden="true">
                      🏡
                    </div>
                  )}
                  <div className="px-2 pb-2 pt-3">
                    <p className="font-semibold text-[#20291D]" style={SERIF}>
                      {n.name}
                    </p>
                    <p className="text-xs text-[#66735F]">{n.city}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[#66735F]">
                      <StarRow value={n.ratingAvg} />
                      <span className="font-bold text-[#20291D]">{n.ratingAvg.toFixed(1)}</span>
                      <span>· {t("products_count", { n: n.productCount })}</span>
                    </div>
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
      <ToastHost />
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
