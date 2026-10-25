// Single source of truth for the deployed site origin.
// Used by OG metadata (metadataBase in the root layout), share links, and the
// Capacitor deep-link host check (native-bridge). Override the deployment
// origin with NEXT_PUBLIC_SITE_URL in the environment; the default is the
// current Vercel deployment.
const RAW = process.env.NEXT_PUBLIC_SITE_URL || "https://tomavine.vercel.app";

export const SITE_URL = RAW.endsWith("/") ? RAW.slice(0, -1) : RAW;

function parse(url: string): { origin: string; host: string } {
  try {
    const u = new URL(url);
    return { origin: u.origin, host: u.host };
  } catch {
    return { origin: "https://tomavine.vercel.app", host: "tomavine.vercel.app" };
  }
}

/** e.g. "https://tomavine.vercel.app" */
export const SITE_ORIGIN = parse(SITE_URL).origin;
/** e.g. "tomavine.vercel.app" (App Links host + deep-link allowlist) */
export const SITE_HOST = parse(SITE_URL).host;
