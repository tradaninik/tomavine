"use client";

// Mission S3 (scope B): sticky bottom bar on mobile with the enquiry
// CTA. Add-to-cart stays in its normal flow above. Hidden for
// out-of-stock products when pre-orders are switched off.

import type { PublicSettings } from "@/lib/settings-shared";

export function ProductMobileBar({
  stock,
  settings,
  labels,
}: {
  stock: number;
  settings: PublicSettings | null;
  labels: { bulk: string; preorder: string };
}) {
  if (stock <= 0 && settings !== null && !settings.preorderEnabled) {
    return null;
  }
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E4E0CE] bg-white/95 p-3 shadow-lg backdrop-blur md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <a
        href="#enquiry"
        className="block w-full rounded-xl bg-[#2F6B3F] px-4 py-3 text-center text-sm font-bold text-white"
      >
        {stock <= 0 ? labels.preorder : labels.bulk}
      </a>
    </div>
  );
}