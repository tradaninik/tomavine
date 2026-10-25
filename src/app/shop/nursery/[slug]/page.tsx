import type { Metadata } from "next";
import { db } from "@/lib/db";
import { NurseryDetail } from "@/components/nursery-detail";

// ─────────────────────────────────────────────────────────────
// Nursery page (server half). The storefront UI is the "use
// client" NurseryDetail component (same code as before the M2
// split — it loads /api/catalog/nursery/[slug] itself); this
// wrapper exists so the route can export generateMetadata
// (client components cannot).
//
// The lookup mirrors the visibility rule of
// /api/catalog/nursery/[slug] (slug + status VERIFIED), so an
// unverified nursery never leaks a name into metadata. On a miss
// the page renders its client-side "not found" empty state with
// HTTP 200 — generateMetadata mirrors that with an empty object
// (no hard notFound()), matching the product page's choice.
// ─────────────────────────────────────────────────────────────

function clampDescription(s: string): string {
  return s.length <= 160 ? s : `${s.slice(0, 157).trimEnd()}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const nursery = await db.nursery.findFirst({
      where: { slug: slug, status: "VERIFIED" },
      select: { name: true, city: true, area: true, image: true, physVerifiedAt: true },
    });
    if (!nursery) {
      // Matches the page: client-side empty state, not a server 404.
      return {};
    }
    const place = nursery.area ? `${nursery.area}, ${nursery.city}` : nursery.city;
    const verified = nursery.physVerifiedAt ? "a physically verified nursery" : "a verified nursery";
    const metadata: Metadata = {
      title: nursery.name,
      description: clampDescription(
        `Plants, saplings and garden supplies from ${nursery.name}, ${place} — ${verified} on Tomavine.`
      ),
      twitter: { card: nursery.image ? "summary_large_image" : "summary" },
    };
    if (nursery.image) {
      metadata.openGraph = { images: [{ url: nursery.image }] };
    }
    return metadata;
  } catch {
    // db hiccup — fall through to the generic title (shop/c/[slug] pattern)
    return {};
  }
}

export default function NurseryPage() {
  return <NurseryDetail />;
}
