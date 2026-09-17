import type { ReactNode } from "react";
import { Footer, Nav } from "./ui";

export const metadata = {
  title: "Tomavine — plants, saplings & garden care",
  description:
    "Shop nursery plants, farmer saplings, organic inputs, pots and tools from physically verified nurseries. Cash on delivery.",
};

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F3E8]">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
      <Footer />
    </div>
  );
}