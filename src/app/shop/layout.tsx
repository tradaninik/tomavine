import type { ReactNode } from "react";
import { Fraunces, Karla } from "next/font/google";
import { Footer, Nav, ToastHost } from "./ui";
import { InstallBanner } from "./pwa";
import { LangProvider } from "@/lib/i18n";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], variable: "--font-body" });

// absolute: the root layout ships a "%s — Tomavine" template — the
// storefront title is already brand-first and must not get a second suffix.
export const metadata = {
  title: { absolute: "Tomavine — plants, saplings & garden care" },
  description:
    "Shop nursery plants, farmer saplings, organic inputs, pots and tools from physically verified nurseries. Cash on delivery.",
};

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} flex min-h-screen flex-col bg-[#F7F3E8]`}
      style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
    >
      <LangProvider>
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
        <Footer />
        <InstallBanner />
        <ToastHost />
      </LangProvider>
    </div>
  );
}