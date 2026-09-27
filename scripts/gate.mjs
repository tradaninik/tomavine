// scripts/gate.mjs — Tomavine one-command verification gate.
//
// Chains the two standing checks and prints ONE verdict:
//   1. node scripts/audit-routes.mjs   (source-level: pages / API / refs / broken links)
//   2. node scripts/smoke.mjs [base]    (runtime probes against a running server)
//
// Usage:
//   node scripts/gate.mjs                              -> local: dev must be running in Terminal 1
//   node scripts/gate.mjs https://tomavine.vercel.app  -> production lap, after the deploy shows Ready
//
// Deliberately NOT chained: npm run build. `next build` must run with the dev
// server STOPPED (concurrent .next writes corrupt it — gotcha 28), so the build
// stays a deliberate manual step: stop dev -> npm run build -> restart dev.
//
// The gate is RED until proven green: a broken link, a failed probe, a crash,
// or a timeout fails the whole gate. Run before EVERY commit and paste the
// verdict block — it carries the numbers the handoff records.

import { spawnSync } from "node:child_process";

const TIMEOUT_MS = 180000;

function run(args) {
  const r = spawnSync(process.execPath, args, { encoding: "utf8", timeout: TIMEOUT_MS });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

function lineStarting(text, prefix) {
  return text.split(/\r?\n/).find((l) => l.startsWith(prefix)) ?? "";
}

function lineContaining(text, needle) {
  return text.split(/\r?\n/).find((l) => l.includes(needle)) ?? "";
}

// ── 1. Route audit ───────────────────────────────────────────
console.log("── Route audit ──");
const audit = run(["scripts/audit-routes.mjs"]);
console.log(audit.out.trim());
const auditCounts = lineStarting(audit.out, "Pages:");
const auditOk = audit.ok && audit.out.includes("No broken internal links found.");

// ── 2. Smoke probes ──────────────────────────────────────────
const base = process.argv[2] ?? "http://localhost:3000";
console.log("\n── Smoke probes - " + base + " ──");
const smoke = run(["scripts/smoke.mjs", base]);
console.log(smoke.out.trim());
const smokeOk = smoke.ok && /All \d+ probes passed\./.test(smoke.out);

// ── Verdict ──────────────────────────────────────────────────
const ok = auditOk && smokeOk;
console.log("\n──────── GATE VERDICT ────────");
console.log(auditCounts || "Audit counts: (not found)");
console.log(lineContaining(smoke.out, "Taxonomy") || "Taxonomy: (not found)");
console.log(lineContaining(smoke.out, "Nursery catalog") || "Nursery catalog: (not found)");
console.log("");
if (!auditOk) {
  console.log("RED: route audit failed (broken link or crash). Fix before committing.");
}
if (!smokeOk) {
  console.log("RED: smoke failed (probe failure, dev not running, or Neon asleep — wait 15s, retry once).");
}
if (ok) {
  console.log("GATE GREEN — safe to commit (after: dev STOPPED -> npm run build -> 51/51 -> restart dev).");
  console.log("Commit by explicit path, never git add -A (gotcha 31).");
}
process.exitCode = ok ? 0 : 1;