#!/usr/bin/env node
// Regenerates public/.well-known/assetlinks.json for Android App Links (M2).
//
// Usage:
//   node scripts/assetlinks.mjs <SHA256> [SHA256 ...]
//
// Fingerprints may be colon-separated (keytool style, e.g. AA:BB:...) or bare
// hex; they are normalised to 64 uppercase hex chars. Pass BOTH fingerprints
// once known: the Play app-signing key (Play Console → Setup → App signing)
// and your local upload keystore (keytool -list), so store installs and
// sideloaded APKs both verify.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", ".well-known", "assetlinks.json");
const PACKAGE = "in.tomavine.app";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/assetlinks.mjs <SHA256> [SHA256 ...]");
  process.exit(2);
}

const fingerprints = args.map((a) => a.replace(/[:\s]/g, "").toUpperCase());
for (const fp of fingerprints) {
  if (!/^[0-9A-F]{64}$/.test(fp)) {
    console.error(`invalid SHA256 fingerprint (expected 64 hex chars): ${fp}`);
    process.exit(2);
  }
}

const doc = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACKAGE,
      sha256_cert_fingerprints: fingerprints,
    },
  },
];

writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(
  `wrote ${OUT} (${fingerprints.length} fingerprint${fingerprints.length === 1 ? "" : "s"})`,
);
