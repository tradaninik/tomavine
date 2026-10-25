import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ProductDetail } from "@/components/product-detail";

// ─────────────────────────────────────────────────────────────
// Product page (server half). The storefront detail UI is the
// "use client" ProductDetail component (same code as before the
// M2 split — it loads /api/catalog/products/[id] itself); this
// wrapper exists so the route can export generateMetadata
// (client components cannot). English metadata for crawlers and
// link unfurlers (WhatsApp, Telegram); the in-page header keeps
// showing the name in the visitor's language.
//
// The lookup mirrors the visibility rules of
// /api/catalog/products/[id] (hidden listings and nurseries that
// are not VERIFIED + retailOk never leak a name into metadata).
// On a miss the page renders its client-side "not found" empty
// state with HTTP 200 — generateMetadata mirrors that with an
// empty object (no hard notFound()), so behavior is unchanged.
// ─────────────────────────────────────────────────────────────

function clampDescription(s: string): string {
  return s.length <= 160 ? s : `${s.slice(0, 157).trimEnd()}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const product = await db.product.findFirst({
      where: { id: id, hidden: false, nursery: { status: "VERIFIED", retailOk: true } },
      select: {
        nameEn: true,
        image: true,
        priceMin: true,
        nursery: { select: { name: true, city: true } },
      },
    });
    if (!product) {
      // Matches the page: client-side empty state, not a server 404.
      return {};
    }
    const metadata: Metadata = {
      title: product.nameEn,
      description: clampDescription(
        `${product.nameEn} from ${product.nursery.name}, ${product.nursery.city} — from ₹${product.priceMin}. Cash on delivery.`
      ),
      twitter: { card: product.image ? "summary_large_image" : "summary" },
    };
    if (product.image) {
      // Product photos are wide-ish — a large card. Without a photo
      // openGraph is left unset so the root layout's icon card applies.
      metadata.openGraph = { images: [{ url: product.image }] };
    }
    return metadata;
  } catch {
    // db hiccup — fall through to the generic title (shop/c/[slug] pattern)
    return {};
  }
}

export default function ProductPage() {
  return <ProductDetail />;
}
