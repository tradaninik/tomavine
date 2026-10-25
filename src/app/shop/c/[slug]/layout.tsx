import type { Metadata } from "next";
import type { ReactNode } from "react";
import { db } from "@/lib/db";

// Server layout for /shop/c/[slug] — the page itself is a client
// component ("use client" storefront convention), so the metadata
// lives here as a co-located server layout (same pattern Mission M1
// documented for product/[id] and nursery/[slug]). English title;
// the in-page header shows the name in the visitor's language.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const node = await db.category.findUnique({
      where: { slug },
      select: { names: true },
    });
    if (node) {
      const names = node.names as Record<string, unknown> | null;
      if (names && typeof names.en === "string" && names.en.length > 0) {
        return { title: names.en };
      }
    }
  } catch {
    // db hiccup — fall through to the generic title
  }
  return { title: "Shop" };
}

export default function CategoryBrowseLayout({ children }: { children: ReactNode }) {
  return children;
}
