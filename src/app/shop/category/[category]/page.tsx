import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";

// Legacy /shop/category/<key> URLs → permanent 308 redirect to the
// tree page /shop/c/<slug>. The 5 legacy keys (plants, saplings,
// inputs, pots, tools) resolve through Category.legacyKey so a
// slug rename would still land correctly; unknown keys are a true
// 404 — nothing is fabricated. Server component (no "use client");
// Next 16 params is a Promise and permanentRedirect serves 308.
export default async function LegacyCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const node = await db.category.findFirst({
    where: { legacyKey: category },
    select: { slug: true },
  });
  if (!node) {
    notFound();
  }
  permanentRedirect(`/shop/c/${node.slug}`);
}
