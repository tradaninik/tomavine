import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Karla } from "next/font/google";
import { Footer, Nav, ToastHost } from "@/app/shop/ui";
import { InstallBanner } from "@/app/shop/pwa";
import { LangProvider } from "@/lib/i18n";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { absolute: "Tomavine - Bulk / Project Enquiry" },
  description:
    "Request a quotation for bulk saplings and plants - for farms, landscapers, hotels and institutions. No login needed.",
};

// Mission S3 (scope C): the RFQ page lives at /bulk with the standard
// storefront chrome (nav, footer, language provider).
export default function BulkLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} flex min-h-screen flex-col bg-[#F7F3E8]`}
      style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
    >
      <LangProvider>
        <Nav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">{children}</main>
        <Footer />
        <InstallBanner />
        <ToastHost />
      </LangProvider>
    </div>
  );
}