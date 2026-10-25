"use client";

// ─────────────────────────────────────────────────────────────
// Mission M2 — Capacitor bridge for the Android shell.
//
// Mounted ONCE in the root layout (covers /shop, /login, …).
// Renders null on the web: the effect returns early unless
// Capacitor reports a native platform, and a failed dynamic
// import (package stripped / plain browser) is swallowed too.
//
// appUrlOpen fires when Android hands the app an App Link
// (https://tomavine.vercel.app/...). Same-host links are routed
// inside the WebView with location.replace (no history entry),
// foreign hosts are handed to the system browser.
// ─────────────────────────────────────────────────────────────

import { useEffect } from "react";
// Capacitor v8 exports PluginListenerHandle from @capacitor/core
// (@capacitor/app only re-imports the type for its own definitions).
import type { PluginListenerHandle } from "@capacitor/core";
import { SITE_HOST } from "@/lib/site";

export function NativeBridge() {
  useEffect(() => {
    let handle: PluginListenerHandle | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        if (cancelled) return;
        handle = await App.addListener("appUrlOpen", (event) => {
          try {
            const url = new URL(event.url);
            if (url.host === SITE_HOST) {
              const target = `${url.pathname}${url.search}${url.hash}`;
              if (target && target !== window.location.pathname + window.location.search + window.location.hash) {
                window.location.replace(target);
              }
            } else {
              window.open(url.href, "_blank", "noopener,noreferrer");
            }
          } catch {
            /* malformed url — ignore */
          }
        });
      } catch {
        /* not running inside Capacitor — ignore */
      }
    })();
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);
  return null;
}
