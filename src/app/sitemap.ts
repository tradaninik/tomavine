import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

// -------------------------------------------------------------
// Mission T1: app/sitemap.ts - served automatically at /sitemap.xml
// with the Next MetadataRoute convention (same pattern as the
// existing app/manifest.ts). The origin comes from src/lib/site.ts
// (honors NEXT_PUBLIC_SITE_URL), so the site URL exists exactly
// once in the codebase.
//
// Contents:
//   - static public routes (storefront, bulk, sell, login, the
//     legal pages and the policy pages)
//   - /shop/nursery/<slug> for every VERIFIED nursery
//   - /shop/c/<slug> for every ACTIVE category node (top or sub;
//     the legacy /shop/category/<key> URLs 308 here, so only the
//     tree form is listed)
//
// DB reads are fail-safe: on any error the sitemap degrades to the
// static routes only, so a build or render never depends on
// database reachability. lib/db is imported dynamically inside the
// try for the same reason - a missing or bad DATABASE_URL must not
// take the build down.
//
// Freshness: the reads run at prerender time, so the file exports
// revalidate - without it the nursery and category sets would stay
// frozen at whatever build produced them.
// -------------------------------------------------------------
export const revalidate = 3600;

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${SITE_ORIGIN}/`, changeFrequency: "daily", priority: 1.0 },
  { url: `${SITE_ORIGIN}/shop/nurseries`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_ORIGIN}/shop/advisor`, changeFrequency: "weekly", priority: 0.8 },
  { url: `${SITE_ORIGIN}/shop/search`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_ORIGIN}/bulk`, changeFrequency: "weekly", priority: 0.8 },
  { url: `${SITE_ORIGIN}/sell`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_ORIGIN}/login`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_ORIGIN}/legal/refund`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SITE_ORIGIN}/legal/shipping`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SITE_ORIGIN}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SITE_ORIGIN}/legal/grievance`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SITE_ORIGIN}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SITE_ORIGIN}/policies/delivery`, changeFrequency: "yearly", priority: 0.4 },
  { url: `${SITE_ORIGIN}/policies/seller`, changeFrequency: "yearly", priority: 0.4 },
];

// NOTE (recorded in t1-worklog.md): /shop is deliberately NOT
// listed - src/app/shop has no page.tsx, the URL 404s today
// (verified on the live deployment). The storefront surfaces via
// /, /shop/nurseries, /shop/advisor, /shop/search and the
// /shop/c/* tree. Product detail pages stay out of T1 as well:
// they need a per-product lastmod source and a cap policy, which
// belongs with the T1B catalog rework.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [...STATIC_ROUTES];
  try {
    // Fail-safe DB half. lib/db is imported dynamically so a missing
    // or bad DATABASE_URL degrades to the static routes instead of
    // crashing the prerender.
    const { db } = await import("@/lib/db");
    const [nurseries, categories] = await Promise.all([
      // VERIFIED only: an unverified nursery has no public page worth
      // advertising (its /shop/nursery/<slug> renders the client-side
      // "not found" empty state).
      db.nursery.findMany({
        where: { status: "VERIFIED" },
        select: { slug: true, physVerifiedAt: true },
      }),
      // Every ACTIVE tree node - top or sub - has a canonical
      // /shop/c/<slug> browse page (parked/inactive ones do not).
      db.category.findMany({ where: { active: true }, select: { slug: true } }),
    ]);
    for (const n of nurseries) {
      entries.push({
        url: `${SITE_ORIGIN}/shop/nursery/${n.slug}`,
        // Nursery has no updatedAt/createdAt; physVerifiedAt is the one
        // honest "last meaningful change" timestamp on the model, and
        // it is null for never-physically-verified rows - lastModified
        // is simply omitted then.
        lastModified: n.physVerifiedAt ?? undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    for (const c of categories) {
      entries.push({
        url: `${SITE_ORIGIN}/shop/c/${c.slug}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // DB unreachable (or not configured) at prerender/revalidate time:
    // ship the static routes only. A thin sitemap beats a failed build.
  }
  return entries;
}
