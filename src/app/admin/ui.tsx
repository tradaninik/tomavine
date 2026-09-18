"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/nurseries", label: "Nurseries" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/audit", label: "Audit log" },
];

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "CONFIRMED":
      return "Confirmed";
    case "PREPARING":
      return "Preparing";
    case "OUT_FOR_DELIVERY":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    case "REJECTED":
      return "Rejected";
    case "VERIFIED":
      return "Verified";
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
    case "VERIFIED":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    default:
      return "bg-stone-100 text-stone-700 border border-stone-200";
  }
}

export const inputCls =
  "w-full rounded-xl border border-[#1C3A2A]/15 bg-white px-3 py-2 text-sm text-[#1C3A2A] outline-none transition focus:border-[#2F6B3F] focus:ring-2 focus:ring-[#2F6B3F]/20";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  );
}

type BtnVariant = "primary" | "outline" | "ghost" | "danger";

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-[#2F6B3F] text-white hover:bg-[#24562F] disabled:bg-[#2F6B3F]/40",
  outline: "border border-[#1C3A2A]/20 bg-white text-[#1C3A2A] hover:bg-[#F7F3E8] disabled:opacity-40",
  ghost: "text-[#2F6B3F] hover:bg-[#2F6B3F]/10 disabled:opacity-40",
  danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/40",
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
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const sizeCls = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-6 py-3 text-base" : "px-4 py-2 text-sm";
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${sizeCls} ${className}`;
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

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1C3A2A]" style={SERIF}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#8E9A84]">{hint}</p> : null}
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

export function Empty({ emoji = "🌱", title, text, action }: { emoji?: string; title: string; text?: string; action?: ReactNode }) {
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

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b-4 border-[#2F6B3F] bg-[#1C3A2A] text-[#F7F3E8]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F7F3E8] text-lg" aria-hidden="true">
            🛡️
          </span>
          <span className="hidden text-lg font-semibold sm:block" style={SERIF}>
            Tomavine Admin
          </span>
        </Link>
        <nav className="ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href
                  ? "whitespace-nowrap rounded-xl bg-white/15 px-3 py-2 font-semibold text-white"
                  : "whitespace-nowrap rounded-xl px-3 py-2 font-semibold text-[#F7F3E8]/80 hover:bg-white/10 hover:text-white"
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/"
          className="shrink-0 rounded-xl bg-[#2F6B3F] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#24562F]"
        >
          Storefront ↗
        </Link>
      </div>
    </header>
  );
}