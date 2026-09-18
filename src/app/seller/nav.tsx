"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/seller", label: "Overview" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/leads", label: "Quotes" },
  { href: "/seller/reviews", label: "Reviews" },
  { href: "/seller/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // network hiccup — still head to login; the cookie clears server-side when the call lands
    }
    router.push("/login");
  }

  return (
    <header className="bg-[#1C3A2A] text-[#F7F3E8]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
        <Link href="/seller" className="text-lg font-bold">
          🌱 Tomavine <span className="font-normal text-[#F7F3E8]/60">Seller</span>
        </Link>
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "rounded-xl bg-[#2F6B3F] px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-xl px-3 py-1.5 text-sm font-medium text-[#F7F3E8]/80 hover:bg-white/10"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={logout}
          disabled={busy}
          className="ml-auto rounded-xl border border-[#F7F3E8]/30 px-3 py-1.5 text-sm font-semibold text-[#F7F3E8] transition hover:bg-white/10 disabled:opacity-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}