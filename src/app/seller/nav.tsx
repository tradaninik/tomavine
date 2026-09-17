"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      </div>
    </header>
  );
}