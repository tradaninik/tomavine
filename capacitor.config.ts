import type { CapacitorConfig } from "@capacitor/cli";

// M2 — server-mode shell: the WebView loads the deployed site, not a local
// bundle (the app is server-rendered: SSR + API routes + Prisma). Override the
// target with CAPACITOR_SERVER_URL (e.g. http://<lan-ip>:3000 while testing
// against `next dev` on your own machine — plain http auto-enables cleartext).
const SERVER_URL = process.env.CAPACITOR_SERVER_URL || "https://tomavine.vercel.app";

const config: CapacitorConfig = {
  appId: "in.tomavine.app",
  appName: "Tomavine",
  // Inert in server mode; a stub so `cap sync` has a webDir (see native-shell/).
  webDir: "native-shell",
  server: {
    url: SERVER_URL,
    androidScheme: "https",
    // Allow plain-http only when an explicit http:// override is set.
    cleartext: SERVER_URL.startsWith("http://"),
  },
};

export default config;
