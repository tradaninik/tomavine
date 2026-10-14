"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CART_EVENT, MAX_QTY, addToCart, cartCount, displayPriceOf, loadCart, setQty } from "@/lib/cart";
import { LangPill, displayName, useLang } from "@/lib/i18n";
import type { ProductCard } from "@/lib/catalog";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

// ── Formatting helpers ────────────────────────────────────────

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function catEmoji(category: string): string {
  switch (category) {
    case "saplings":
      return "🌾";
    case "plants":
      return "🪴";
    case "inputs":
      return "🧪";
    case "pots":
      return "🏺";
    case "tools":
      return "🛠️";
    default:
      return "🌱";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending confirmation";
    case "CONFIRMED":
      return "Confirmed";
    case "PREPARING":
      return "Being prepared";
    case "OUT_FOR_DELIVERY":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    case "REJECTED":
      return "Rejected by seller";
    default:
      return status;
  }
}

export function statusTone(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "CONFIRMED":
      return "bg-sky-100 text-sky-800 border border-sky-200";
    case "PREPARING":
      return "bg-indigo-100 text-indigo-800 border border-indigo-200";
    case "OUT_FOR_DELIVERY":
      return "bg-violet-100 text-violet-800 border border-violet-200";
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "CANCELLED":
      return "bg-rose-100 text-rose-700 border border-rose-200";
    case "REJECTED":
      return "bg-rose-100 text-rose-700 border border-rose-200";
    default:
      return "bg-stone-100 text-stone-700 border border-stone-200";
  }
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export const inputCls =
  "w-full rounded-xl border border-[#1C3A2A]/15 bg-white px-3 py-2 text-sm text-[#1C3A2A] outline-none transition focus:border-[#2F6B3F] focus:ring-2 focus:ring-[#2F6B3F]/20";

// ── Small building blocks ─────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  );
}

type BtnVariant = "primary" | "forest" | "outline" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-[#2F6B3F] text-white hover:bg-[#24562F] disabled:bg-[#2F6B3F]/40",
  forest: "bg-[#1C3A2A] text-[#F7F3E8] hover:bg-[#12271A] disabled:bg-[#1C3A2A]/40",
  outline: "border border-[#1C3A2A]/20 bg-white text-[#1C3A2A] hover:bg-[#F7F3E8] disabled:opacity-40",
  ghost: "text-[#2F6B3F] hover:bg-[#2F6B3F]/10 disabled:opacity-40",
  danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/40",
};

const BTN_SIZES: Record<BtnSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Btn({
  children,
  onClick,
  href,
  variant = "primary",
  size = "md",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

type PillTone = "leaf" | "forest" | "cream" | "amber" | "rose" | "sky";

const PILL_TONES: Record<PillTone, string> = {
  leaf: "bg-[#2F6B3F]/10 text-[#24562F] border border-[#2F6B3F]/20",
  forest: "bg-[#1C3A2A] text-[#F7F3E8] border border-[#1C3A2A]",
  cream: "bg-[#F7F3E8] text-[#1C3A2A] border border-[#1C3A2A]/10",
  amber: "bg-amber-100 text-amber-800 border border-amber-200",
  rose: "bg-rose-100 text-rose-700 border border-rose-200",
  sky: "bg-sky-100 text-sky-800 border border-sky-200",
};

export function Pill({ children, tone = "leaf", className = "" }: { children: ReactNode; tone?: PillTone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Price({ price, mrp }: { price: number; mrp?: number }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-lg font-bold text-[#1C3A2A]">{inr(price)}</span>
      {mrp && mrp > price ? <span className="text-sm text-[#8E9A84] line-through">{inr(mrp)}</span> : null}
    </span>
  );
}

export function RescueBadge({ pct }: { pct: number }) {
  return (
    <Pill tone="amber">
      <span aria-hidden="true">🏷️</span> Rescue −{pct}%
    </Pill>
  );
}

export function StockPill({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <Pill tone="rose">Out of stock</Pill>;
  }
  if (stock <= 5) {
    return <Pill tone="amber">Only {stock} left</Pill>;
  }
  return <Pill tone="leaf">In stock</Pill>;
}

export function StarRow({ value, className = "" }: { value: number; className?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={`text-sm ${className}`} aria-label={`${value} out of 5 stars`}>
      <span className="text-[#E39B2D]">{"★".repeat(filled)}</span>
      <span className="text-[#D6D2BC]">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (stars: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
          onClick={() => onChange(s)}
          className="text-2xl leading-none transition hover:scale-110"
        >
          <span className={s <= value ? "text-[#E39B2D]" : "text-[#D6D2BC]"}>★</span>
        </button>
      ))}
      <span className="ml-2 text-sm font-semibold text-[#1C3A2A]">{value > 0 ? `${value}/5` : "Tap to rate"}</span>
    </div>
  );
}

export function ProductThumb({
  category,
  size = "md",
  className = "",
}: {
  category: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes: Record<"sm" | "md" | "lg", string> = {
    sm: "h-16 w-16 text-2xl",
    md: "h-28 w-28 text-4xl",
    lg: "h-44 w-44 text-6xl",
  };
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EDF2E6] via-[#F7F3E8] to-[#A9C3A0]/30 ${sizes[size]} ${className}`}>
      <span aria-hidden="true">{catEmoji(category)}</span>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-[#1C3A2A]/60">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[#1C3A2A]/50">{hint}</span> : null}
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl font-semibold text-[#1C3A2A] sm:text-3xl" style={SERIF}>
        {children}
      </h1>
      {action}
    </div>
  );
}

export function Empty({
  emoji = "🌱",
  title,
  text,
  action,
}: {
  emoji?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#1C3A2A]/20 bg-white/60 p-10 text-center">
      <p className="text-4xl" aria-hidden="true">
        {emoji}
      </p>
      <h2 className="mt-3 text-lg font-semibold text-[#1C3A2A]">{title}</h2>
      {text ? <p className="mx-auto mt-1 max-w-md text-sm text-[#1C3A2A]/60">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[#1C3A2A]/60">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#2F6B3F] border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrBox({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{children}</div>;
}

// ── Toasts (event-based, no extra state libraries) ───────────

let toastSeq = 0;

export function toast(message: string): void {
  if (typeof window === "undefined") {
    return;
  }
  toastSeq = toastSeq + 1;
  window.dispatchEvent(new CustomEvent("tomavine:toast", { detail: { id: toastSeq, message: message } }));
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; message: string }[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: number; message: string };
      setItems((prev) => [...prev, { id: detail.id, message: detail.message }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== detail.id));
      }, 2600);
    };
    window.addEventListener("tomavine:toast", handler);
    return () => window.removeEventListener("tomavine:toast", handler);
  }, []);

  if (items.length === 0) {
    return null;
  }
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,430px)] -translate-x-1/2 flex-col gap-2">
      {items.map((x) => (
        <div key={x.id} className="flex items-center gap-2 rounded-2xl bg-[#1C3A2A] px-4 py-3 text-sm text-[#F7F3E8] shadow-xl">
          <span aria-hidden="true">🌿</span>
          <span className="font-semibold">{x.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Product card (used by landing, category, rescue, nursery, search) ──

export function ProductTile({ p }: { p: ProductCard }) {
  const { lang, t } = useLang();
  const name = displayName(p.names, lang, p.nameEn);
  const variantId = p.variants.length > 0 ? p.variants[0].id : null;
  const dp = displayPriceOf(p, variantId);
  const cap = Math.min(p.stock, MAX_QTY);

  // Cart state is read only in effects/handlers (SSR has no localStorage)
  // and kept fresh on every tile via the global cart event.
  const [qty, setQtyValue] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const line = loadCart().find((l) => l.productId === p.id && l.variantId === variantId);
      setQtyValue(line ? line.qty : 0);
    };
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    return () => window.removeEventListener(CART_EVENT, refresh);
  }, [p.id, variantId]);

  function handleFirstAdd() {
    if (p.stock <= 0) {
      return;
    }
    const res = addToCart(p.id, variantId, 1);
    if (!res.ok && res.reason) {
      toast(res.reason);
    }
  }

  function stepUp() {
    if (qty >= cap) {
      return;
    }
    setQty(p.id, variantId, qty + 1);
  }

  function stepDown() {
    setQty(p.id, variantId, qty - 1);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[#E4E0CE] bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/shop/product/${p.id}`} className="relative block aspect-square overflow-hidden bg-gradient-to-br from-[#EDF2E6] via-[#F7F3E8] to-[#A9C3A0]/30">
        <span className="absolute inset-0 flex items-center justify-center text-6xl transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
          {catEmoji(p.category)}
        </span>
        {p.rescue && dp.before > dp.now ? (
          <span className="absolute left-3 top-3 rounded-full bg-[#C14E2A] px-2.5 py-0.5 text-xs font-bold text-white shadow">
            🏷️ −{p.rescue.pct}%
          </span>
        ) : null}
        {p.stock <= 0 ? (
          <span className="absolute inset-0 flex items-center justify-center bg-[#F7F3E8]/80 text-sm font-bold uppercase tracking-wide text-[#1C3A2A]">
            {t("out_of_stock")}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/shop/product/${p.id}`} className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#20291D]" style={SERIF}>
          {name}
        </Link>
        {p.botanical ? (
          <p className="truncate text-xs italic text-[#8E9A84]" style={SERIF}>
            {p.botanical}
          </p>
        ) : null}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-[#1C3A2A]">{inr(dp.now)}</span>
          {dp.before > dp.now ? (
            <span className="text-xs text-[#8E9A84] line-through">{inr(dp.before)}</span>
          ) : p.mrp > dp.now ? (
            <span className="text-xs text-[#8E9A84] line-through">{inr(p.mrp)}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#66735F]">
          <StarRow value={p.avgStars} />
          {p.reviewCount > 0 ? <span>({p.reviewCount})</span> : null}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Link href={`/shop/nursery/${p.nurserySlug}`} className="truncate text-xs font-semibold text-[#2F6B3F] hover:underline">
            {p.nurseryName} · {p.nurseryCity}
          </Link>
          {p.stock <= 0 ? (
            <Btn size="sm" disabled className="w-full">
              🛒 {t("add_to_cart")}
            </Btn>
          ) : qty > 0 ? (
            <div className="flex w-full items-center justify-between rounded-xl bg-[#2F6B3F] text-white transition hover:bg-[#24562F]">
              <button
                type="button"
                onClick={stepDown}
                aria-label="Remove one"
                className="grid h-9 w-10 place-items-center rounded-xl text-lg font-bold leading-none hover:bg-white/15"
              >
                −
              </button>
              <span className="min-w-8 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={stepUp}
                disabled={qty >= cap}
                aria-label="Add one"
                className="grid h-9 w-10 place-items-center rounded-xl text-lg font-bold leading-none hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                +
              </button>
            </div>
          ) : (
            <Btn onClick={handleFirstAdd} size="sm" className="w-full">
              🛒 {t("add_to_cart")}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Storefront chrome (Nav + Footer) ─────────────────────────

type NavUser = {
  name: string | null;
  phone: string;
  role: string;
};

const NAV_LINKS = [
  { href: "/shop/category/plants", key: "plants", accent: false },
  { href: "/shop/category/saplings", key: "saplings", accent: false },
  { href: "/shop/category/inputs", key: "inputs", accent: false },
  { href: "/shop/category/pots", key: "pots", accent: false },
  { href: "/shop/category/tools", key: "tools", accent: false },
  { href: "/shop/nurseries", key: "nurseries", accent: false },
  { href: "/shop/rescue", key: "rescue", accent: true },
];

export function Nav() {
  const { t } = useLang();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [user, setUser] = useState<NavUser | null>(null);
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const refresh = () => setCount(cartCount(loadCart()));
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    return () => window.removeEventListener(CART_EVENT, refresh);
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
      setQ("");
      setMenuOpen(false);
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
      // ignore network errors — clear local state and go home regardless
    }
    setUser(null);
    setLoggingOut(false);
    setMenuOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4E0CE] bg-[#F7F3E8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1C3A2A] text-lg" aria-hidden="true">
            🌱
          </span>
          <span className="hidden text-lg font-semibold text-[#1C3A2A] sm:block" style={SERIF}>
            Tomavine
          </span>
        </Link>
        <form onSubmit={submitSearch} className="mx-2 hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-[#D6D2BC] bg-white px-4 py-1.5 md:flex">
          <span aria-hidden="true" className="text-sm text-[#8E9A84]">
            🔍
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_ph")}
            aria-label={t("search_ph")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
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
                className="hidden rounded-xl border border-[#D6D2BC] bg-white px-3 py-2 text-sm font-semibold text-[#66735F] transition hover:border-[#C14E2A] hover:text-[#C14E2A] disabled:opacity-50 sm:block"
              >
                {t("logout")}
              </button>
            </>
          ) : (
            <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#1C3A2A]/80 hover:bg-[#2F6B3F]/10 sm:block">
              {t("login")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="rounded-xl border border-[#D6D2BC] bg-white px-3 py-2 text-sm font-semibold text-[#1C3A2A] transition hover:bg-[#F7F3E8] md:hidden"
          >
            ☰
          </button>
          <Link
            href="/shop/cart"
            className="relative inline-flex items-center gap-2 rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24562F]"
          >
            <span aria-hidden="true">🛒</span>
            <span className="hidden sm:inline">{t("cart")}</span>
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E39B2D] px-1 text-xs font-bold text-[#1C3A2A]">
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
      {menuOpen ? (
        <div className="border-t border-[#E4E0CE] bg-white px-4 py-3 md:hidden">
          <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-full border border-[#D6D2BC] bg-[#F7F3E8] px-4 py-2">
            <span aria-hidden="true" className="text-sm text-[#8E9A84]">
              🔍
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search_ph")}
              aria-label={t("search_ph")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {user ? (
              <>
                <Link
                  href="/shop/orders"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl bg-[#EDF2E6] px-4 py-2.5 text-sm font-semibold text-[#1C3A2A]"
                >
                  📦 {t("my_orders")}
                </Link>
                {user.role === "ADMIN" ? (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl bg-[#EDF2E6] px-4 py-2.5 text-sm font-semibold text-[#1C3A2A]"
                  >
                    {t("admin")}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="rounded-xl border border-[#D6D2BC] px-4 py-2.5 text-sm font-semibold text-[#66735F] transition hover:border-[#C14E2A] hover:text-[#C14E2A] disabled:opacity-50"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-[#2F6B3F] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {t("login")}
              </Link>
            )}
          </div>
        </div>
      ) : null}
      <nav className="border-t border-[#E4E0CE]/60">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.accent
                  ? "whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800 hover:bg-amber-200"
                  : "whitespace-nowrap rounded-full px-3 py-1 font-medium text-[#1C3A2A]/70 hover:bg-[#2F6B3F]/10 hover:text-[#1C3A2A]"
              }
            >
              {t(link.key)}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 bg-[#1C3A2A] px-4 py-8 text-center text-sm text-[#F7F3E8]/60">
      <p className="text-base font-semibold text-[#F7F3E8]" style={SERIF}>
        🌱 Tomavine
      </p>
      <p className="mt-1">Where growers meet gardens</p>
      <p className="mt-1 text-xs">Cash on delivery · From physically verified nurseries</p>
    </footer>
  );
}