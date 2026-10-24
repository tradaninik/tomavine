import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest — the app/manifest.ts file convention
// makes Next inject the <link rel="manifest"> tag automatically, with
// zero new dependencies. Icons are original artwork (scripts/make-icons.py,
// recorded in public/photos/CREDITS.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Tomavine — Plants, Saplings & Garden Care",
    short_name: "Tomavine",
    description:
      "Plants, saplings, organic inputs, pots and tools from physically verified nurseries — with cash on delivery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F3E8",
    theme_color: "#1C3A2A",
    lang: "en",
    dir: "ltr",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
