"use client";

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  kind = "primary",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const kinds: Record<string, string> = {
    primary: "bg-[#2F6B3F] text-white hover:bg-[#255732]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "border border-[#2F6B3F] text-[#2F6B3F] hover:bg-[#2F6B3F]/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${kinds[kind]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, sub = "" }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-[#1C3A2A] p-5 text-[#F7F3E8]">
      <p className="text-xs uppercase tracking-wide text-[#F7F3E8]/60">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-[#F7F3E8]/60">{sub}</p> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "gray" | "blue";
}) {
  const tones: Record<string, string> = {
    green: "bg-[#2F6B3F]/10 text-[#2F6B3F]",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-100 text-blue-700",
  };

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): "green" | "amber" | "red" | "gray" | "blue" {
  if (status === "DELIVERED") {
    return "green";
  }

  if (status === "PENDING") {
    return "amber";
  }

  if (status === "REJECTED" || status === "CANCELLED") {
    return "red";
  }

  if (status === "OUT_FOR_DELIVERY") {
    return "blue";
  }

  return "gray";
}

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}