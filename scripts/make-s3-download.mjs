#!/usr/bin/env node
/**
 * Produces the S3 delivery artifact set. Run AFTER the S3 commit exists:
 *   1. git format-patch -1 HEAD --binary
 *   2. SHA256 + byte count
 *   3. download/index.html with a green download button
 * Usage: node scripts/make-s3-download.mjs [outputDir]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "s3-download";
mkdirSync(outDir, { recursive: true });

const produced = execFileSync("git", ["format-patch", "-1", "HEAD", "--binary", "-o", outDir], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);
if (produced.length !== 1) {
  console.error("Expected exactly one patch file, got:", produced);
  process.exit(1);
}

produced[0] = produced[0].split(/[\\/]/).pop();
const finalName = "tomavine-s3.patch";
renameSync(join(outDir, produced[0]), join(outDir, finalName));
const buf = readFileSync(join(outDir, finalName));
const bytes = buf.length;
const sha256 = createHash("sha256").update(buf).digest("hex");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TOMAVINE - S3 patch download</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1rem">
<h1 style="color:#15803d">TOMAVINE - S3 patch</h1>
<p>One clean commit. Apply with <code>git am</code>.</p>
<a href="${finalName}" download style="display:inline-block;background:#16a34a;color:#fff;font-weight:700;padding:1rem 2rem;border-radius:12px;text-decoration:none;font-size:1.1rem">&#11015; Download ${finalName}</a>
<table style="margin-top:1.5rem;font-size:0.9rem;border-spacing:0 4px">
<tr><td style="padding-right:1rem"><strong>File</strong></td><td><code>${finalName}</code></td></tr>
<tr><td><strong>Bytes</strong></td><td>${bytes}</td></tr>
<tr><td><strong>SHA256</strong></td><td><code style="word-break:break-all">${sha256}</code></td></tr>
</table>
</body></html>`;
writeFileSync(join(outDir, "index.html"), html);

console.log("Artifact ready in " + outDir + "/");
console.log("file:    " + finalName);
console.log("bytes:   " + bytes);
console.log("sha256:  " + sha256);
console.log("serve:   cd " + outDir + " && python -m http.server 3000");