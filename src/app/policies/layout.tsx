import type { ReactNode } from "react";
import Link from "next/link";
import { Fraunces, Karla } from "next/font/google";
import { LangProvider } from "@/lib/i18n";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], variable: "--font-body" });

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

// Mission S3 (scope D): standalone policy chrome - same pattern as the
// /legal pages, plus the language provider so policy text renders in
// the visitor's chosen language.
export default function PoliciesLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} flex min-h-screen flex-col bg-[#F7F3E8]`}
      style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
    >
      <LangProvider>
        <header
          className="sticky top-0 z-40 border-b border-[#E4E0CE] bg-[#F7F3E8]/95 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1C3A2A] text-lg" aria-hidden="true">
                &#127793;
              </span>
              <span className="text-lg font-semibold text-[#1C3A2A]" style={SERIF}>
                Tomavine
              </span>
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[#1C3A2A]/15 bg-white px-3 py-2 text-sm font-semibold text-[#1C3A2A] transition hover:border-[#2F6B3F] hover:text-[#2F6B3F]"
            >
              &larr; Back to shop
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">{children}</main>
        <footer
          className="mt-16 bg-[#1C3A2A] px-4 py-6 text-center text-xs text-[#F7F3E8]/60"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
        >
          <p>&#127793; Tomavine &middot; Nurseries are the sellers of record</p>
        </footer>
      </LangProvider>
    </div>
  );
}