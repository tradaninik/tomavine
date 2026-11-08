import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

// -------------------------------------------------------------
// Mission T1: app/robots.ts - served automatically at /robots.txt
// with the Next MetadataRoute convention (same pattern as the
// existing app/manifest.ts). The origin comes from src/lib/site.ts
// so the site URL exists exactly once in the codebase.
//
// Everything public is crawlable. The excluded prefixes:
//   /admin   - super admin workspace (auth-gated)
//   /seller  - seller workspace (auth-gated)
//   /api     - JSON endpoints (no SEO value, rate-limited)
//   /order/  - public order tracking by unguessable token
//   /quote/  - public quote view by unguessable token
// The token URLs are shared person-to-person; they have no SEO
// value and must never leak into an index.
// Fully static content - no DB reads, no revalidate needed.
// -------------------------------------------------------------
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/seller", "/api", "/order/", "/quote/"],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
