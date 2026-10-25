"use client";

// ─────────────────────────────────────────────────────────────
// Mission M2 — share affordances for detail pages.
//
// Three buttons: WhatsApp (wa.me deep link), copy link, and —
// only where the Web Share API exists — the system share sheet.
// i18n keys (share / share_whatsapp / copy_link / link_copied)
// come from DICT_M2 in src/lib/i18n-m2.ts via useLang(), the
// same hook every storefront client component uses.
//
// SSR-safe by construction, pwa.tsx pattern: window.location and
// navigator.share availability are captured once on mount inside
// a timer callback — never synchronously in an effect body, never
// during render — so server HTML and hydration match. Mount sites
// key the row by entity id/slug, so a client-side navigation to
// another detail page remounts it with a fresh URL.
//
// Styling: the app's secondary button (Btn variant="outline"
// size="md" in src/app/shop/ui.tsx), class-for-class. Text-only —
// the storefront's icon vocabulary is emoji, which share buttons
// deliberately don't add to.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

const OUTLINE =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#1C3A2A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#1C3A2A] transition hover:bg-[#F7F3E8]";

export function ShareRow({ title, text }: { title: string; text?: string }) {
  const { t } = useLang();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  // Current page URL + Web Share availability, captured once (the
  // timer indirection keeps setState out of the effect body).
  useEffect(() => {
    const boot = window.setTimeout(() => {
      setUrl(window.location.href);
      setCanShare("share" in navigator);
    }, 0);
    return () => {
      window.clearTimeout(boot);
    };
  }, []);

  // The "link copied" flash must never fire after unmount.
  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) {
        window.clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  function whatsappHref(): string {
    const message = [title, text, url]
      .filter((part) => typeof part === "string" && part.trim() !== "")
      .join("\n");
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copiedTimer.current !== null) {
        window.clearTimeout(copiedTimer.current);
      }
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (insecure context / denied) — stay quiet
    }
  }

  function shareNative() {
    navigator
      .share({ title, text, url: window.location.href })
      .catch(() => {
        // user cancelled (AbortError) or no target — swallow silently
      });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={OUTLINE}>
        {t("share_whatsapp")}
      </a>
      <button type="button" onClick={copyLink} className={OUTLINE} aria-live="polite">
        {copied ? t("link_copied") : t("copy_link")}
      </button>
      {canShare ? (
        <button type="button" onClick={shareNative} className={OUTLINE}>
          {t("share")}
        </button>
      ) : null}
    </div>
  );
}
