import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Root metadata: real branding for every route that does not override it
// (home, login, sell). The shop/admin layouts set their own titles; the
// template appends the brand to child-segment titles ("Seller workspace").
export const metadata: Metadata = {
  applicationName: "Tomavine",
  title: {
    default: "Tomavine — plants, saplings & garden care",
    template: "%s — Tomavine",
  },
  description:
    "Shop nursery plants, farmer saplings, organic inputs, pots and tools from physically verified nurseries. Cash on delivery.",
  appleWebApp: {
    capable: true,
    title: "Tomavine",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

// viewportFit cover + safe-area paddings (header/footer/banner) keep the
// standalone PWA clear of notches and the iOS home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1C3A2A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
