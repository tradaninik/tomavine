"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CART_EVENT, cartCount, loadCart } from "@/lib/cart";

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
  primary: "bg-[#2F6B3F] text-white hover:bg-[#255732] disabled:bg-[#2F6B3F]/40",
  forest: "bg-[#1C3A2A] text-[#F7F3E8] hover:bg-[#12251a] disabled:bg-[#1C3A2A]/40",
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
  leaf: "bg-[#2F6B3F]/10 text-[#255732] border border-[#2F6B3F]/20",
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
      {mrp && mrp > price ? <span className="text-sm text-[#1C3A2A]/40 line-through">{inr(mrp)}</span> : null}
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
      <span className="text-amber-500">{"★".repeat(filled)}</span>
      <span className="text-stone-300">{"★".repeat(5 - filled)}</span>
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
          <span className={s <= value ? "text-amber-500" : "text-stone-300"}>★</span>
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
    <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2F6B3F]/15 via-[#F7F3E8] to-[#2F6B3F]/10 ${sizes[size]} ${className}`}>
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
      <h1 className="text-2xl font-bold text-[#1C3A2A] sm:text-3xl">{children}</h1>
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

// ── Storefront chrome (Nav + Footer) ─────────────────────────

type NavUser = {
  name: string | null;
  phone: string;
  role: string;
};

const NAV_LINKS = [
  { href: "/shop/category/plants", label: "Plants", accent: false },
  { href: "/shop/category/saplings", label: "Saplings", accent: false },
  { href: "/shop/category/inputs", label: "Inputs", accent: false },
  { href: "/shop/category/pots", label: "Pots", accent: false },
  { href: "/shop/category/tools", label: "Tools", accent: false },
  { href: "/shop/nurseries", label: "Nurseries", accent: false },
  { href: "/shop/rescue", label: "🏷️ Rescue Corner", accent: true },
];

export function Nav() {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState<NavUser | null>(null);

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

  return (
    <header className="sticky top-0 z-40 border-b border-[#1C3A2A]/10 bg-[#F7F3E8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-[#1C3A2A]">
          <span aria-hidden="true">🌱</span>
          <span>Tomavine</span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/shop/orders"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#1C3A2A]/80 hover:bg-[#2F6B3F]/10"
            >
              My Orders
            </Link>
          ) : (
            <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-[#1C3A2A]/80 hover:bg-[#2F6B3F]/10">
              Login
            </Link>
          )}
          <Link
            href="/shop/cart"
            className="relative inline-flex items-center gap-2 rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255732]"
          >
            <span aria-hidden="true">🛒</span>
            <span className="hidden sm:inline">Cart</span>
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-bold text-[#1C3A2A]">
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
      <nav className="border-t border-[#1C3A2A]/5">
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
              {link.label}
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
      <p>Tomavine · Where growers meet gardens</p>
      <p className="mt-1 text-xs">Cash on delivery · From physically verified nurseries</p>
    </footer>
  );
}