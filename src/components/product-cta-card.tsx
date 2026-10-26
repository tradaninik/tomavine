"use client";

// Mission S3 (scope B): prominent bulk / pre-order CTA. Sticky card
// beside the buy box; the primary green button opens the enquiry
// form. When the product is out of stock the Pre-order label takes
// the primary position. The WhatsApp button appears only when the
// owner has configured a number. Hidden entirely for out-of-stock
// products when pre-orders are switched off in the seller console.

import { useState } from "react";
import { whatsappLink, type PublicSettings } from "@/lib/settings-shared";

export function ProductCtaCard({
  name,
  stock,
  settings,
  labels,
}: {
  name: string;
  stock: number;
  settings: PublicSettings | null;
  labels: { bulk: string; preorder: string; whatsapp: string; qty: string };
}) {
  const [qty, setQty] = useState(10);

  if (stock <= 0 && settings !== null && !settings.preorderEnabled) {
    return null;
  }
  const isPreorder = stock <= 0;

  return (
    <div className="rounded-2xl border-2 border-[#2F6B3F]/40 bg-[#EDF2E6]/60 p-4 lg:sticky lg:top-28">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="s3-cta-qty" className="text-xs font-semibold tracking-wide text-[#1C3A2A]/60">
          {labels.qty}
        </label>
        <input
          id="s3-cta-qty"
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
          className="w-24 rounded-xl border border-[#1C3A2A]/15 bg-white px-3 py-2 text-sm"
        />
      </div>
      <a
        href="#enquiry"
        className="mt-3 block w-full rounded-xl bg-[#2F6B3F] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[#24562F]"
      >
        {isPreorder ? labels.preorder : labels.bulk}
      </a>
      {settings !== null && settings.whatsappNumber ? (
        <a
          href={whatsappLink(
            settings.whatsappNumber,
            "Hello! I would like a quotation for " + name + " - qty " + qty + "."
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded-xl border-2 border-[#2F6B3F] px-4 py-3 text-center text-sm font-bold text-[#2F6B3F] transition hover:bg-[#EDF2E6]"
        >
          {labels.whatsapp}
        </a>
      ) : null}
    </div>
  );
}