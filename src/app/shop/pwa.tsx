"use client";

// Install prompt for the Tomavine PWA (mission M1).
//
// - Chrome/Android: listens for beforeinstallprompt and shows a banner
//   with a working Install button (calls the stashed prompt()).
// - iOS Safari: beforeinstallprompt does not exist there — the banner
//   shows the manual Share > Add to Home Screen steps instead.
// - Dismissals persist for 14 days via localStorage.
// - Never renders when already running standalone (installed).
//
// Rendered by the shop layout and the landing page, inside LangProvider.

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tomavine_install_dismissed";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const { t } = useLang();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // Eligibility is captured once; setState only ever happens inside
    // callbacks (timer / event listener), never synchronously in the body.
    const skip = standalone || dismissedRecently();
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

    const timer = window.setTimeout(() => {
      if (!skip && isIos) {
        setIos(true);
      }
    }, 0);

    const onPrompt = (e: Event) => {
      if (skip) return;
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (dismissed) return null;
  // Android shows once the browser offers the install; iOS shows the hint
  // banner straight away (it can never capture a prompt event).
  if (!promptEvent && !ios) return null;

  async function install() {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setPromptEvent(null);
      }
    } catch {
      setPromptEvent(null);
    }
  }

  function later() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode — fall back to hiding for this visit only
    }
    setDismissed(true);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E4E0CE] bg-[#F7F3E8]/95 shadow-[0_-8px_24px_rgba(28,58,42,0.15)] backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, not remote content */}
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1C3A2A]">{t("install_title")}</p>
          <p className="truncate text-xs text-[#1C3A2A]/70">
            {promptEvent ? t("install_sub") : t("install_ios")}
          </p>
        </div>
        {promptEvent ? (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24562F]"
          >
            {t("install_cta")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={later}
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-[#66735F] transition hover:bg-[#2F6B3F]/10"
        >
          {t("install_later")}
        </button>
      </div>
    </div>
  );
}
