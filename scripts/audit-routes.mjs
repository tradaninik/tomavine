// scripts/audit-routes.mjs
// Static audit: finds internal links (href / router.push / redirect / fetch)
// that point at routes which do not exist in src/app.
// Run:  node scripts/audit-routes.mjs
// Safe to run any time — read-only, no server needed, no database touched.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const APP_DIR = join(ROOT, "src", "app");
const SRC_DIR = join(ROOT, "src");

// Paths that exist only via next.config.mjs rewrites (none today).
// If you ever add rewrites, list them here so they are not flagged.
const REWRITE_PATHS = [];

// ── 1. Collect every real route from src/app ──────────────

const pageRoutes = [];
const apiRoutes = [];

function walkRoutes(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const hasPage = entries.some((e) => e.isFile() && e.name === "page.tsx");
  const hasRoute = entries.some((e) => e.isFile() && e.name === "route.ts");
  if (hasPage || hasRoute) {
    const rel = relative(APP_DIR, dir);
    const routePath = rel === "" ? "/" : "/" + rel.split(sep).join("/");
    if (hasPage) {
      pageRoutes.push(routePath);
    }
    if (hasRoute) {
      apiRoutes.push(routePath);
    }
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      walkRoutes(join(dir, e.name));
    }
  }
}
walkRoutes(APP_DIR);

// ── 2. Collect every internal link reference in src ──────

function walkFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      walkFiles(join(dir, e.name), out);
    } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
      out.push(join(dir, e.name));
    }
  }
}
const files = [];
walkFiles(SRC_DIR, files);

const refs = [];

function addRef(file, line, raw) {
  let p = raw.trim();
  if (!p.startsWith("/") || p.startsWith("//")) {
    return; // external link, anchor, or relative path
  }
  p = p.split("?")[0]; // strip query string
  p = p.replace(/\$\{[^}]*\}/g, "*"); // template values become wildcards
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  if (p === "") {
    p = "/";
  }
  refs.push({ file: file, line: line, path: p });
}

const PATTERNS = [
  /href=\{\s*`([^`]+)`\s*\}/g,
  /href=\{\s*"([^"]+)"\s*\}/g,
  /href="([^"]+)"/g,
  /\brouter\.push\(\s*`([^`]+)`\s*\)/g,
  /\brouter\.push\(\s*"([^"]+)"\s*\)/g,
  /\brouter\.replace\(\s*`([^`]+)`\s*\)/g,
  /\brouter\.replace\(\s*"([^"]+)"\s*\)/g,
  /\bredirect\(\s*`([^`]+)`\s*\)/g,
  /\bredirect\(\s*"([^"]+)"\s*\)/g,
  /\bfetch\(\s*`([^`]+)`\s*[,)]/g,
  /\bfetch\(\s*"([^"]+)"\s*[,)]/g,
];

for (const f of files) {
  const content = readFileSync(f, "utf8");
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m = re.exec(content);
    while (m !== null) {
      const line = content.slice(0, m.index).split("\n").length;
      addRef(f, line, m[1]);
      m = re.exec(content);
    }
  }
}

// ── 3. Match references against real routes ──────────────

function segments(p) {
  if (p === "/") {
    return [];
  }
  return p.slice(1).split("/");
}

function matches(refPath, routePath) {
  const a = segments(refPath);
  const b = segments(routePath);
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (b[i].startsWith("[")) {
      continue; // dynamic route segment matches anything
    }
    if (a[i] === "*") {
      continue; // template value matches anything
    }
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

const allRoutes = pageRoutes.concat(apiRoutes).concat(REWRITE_PATHS);

const broken = [];
const seen = new Set();
for (const r of refs) {
  const key = r.file + ":" + r.path;
  if (seen.has(key)) {
    continue;
  }
  seen.add(key);
  if (!allRoutes.some((route) => matches(r.path, route))) {
    broken.push(r);
  }
}

// ── 4. Report ────────────────────────────────────────────

console.log("Tomavine route audit");
console.log("Pages: " + pageRoutes.length + " · API routes: " + apiRoutes.length + " · References scanned: " + refs.length);
console.log("");

if (broken.length === 0) {
  console.log("No broken internal links found.");
} else {
  console.log("BROKEN LINKS (" + broken.length + "):");
  for (const b of broken) {
    const where = relative(ROOT, b.file).split(sep).join("/");
    console.log("  " + where + ":" + b.line + "  ->  " + b.path);
  }
  console.log("");
  console.log("Fix these, then re-run until the list is empty.");
}