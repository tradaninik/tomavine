// scripts/smoke.mjs - Tomavine read-only smoke probes.
// Usage:
//   node scripts/smoke.mjs                              (auto-finds dev on 3000-3002)
//   node scripts/smoke.mjs http://localhost:3001        (explicit base)
//   node scripts/smoke.mjs https://tomavine.vercel.app  (probes production)
// All probes are read-only: no logins, no orders, no writes.
// First run after idle may be slow - Neon waking up. Wait 15s, re-run.
//
// Port auto-detection: with no URL argument, probes localhost:3000,
// :3001, :3002 and uses the first that serves Tomavine's landing
// page (a busy port is not proof — another app may hold 3000).
// Falls back to 3000 when nothing answers, so failures read normally.

const explicit = process.argv[2];

async function isTomavine(base) {
  try {
    const res = await fetch(base + "/", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return false;
    }
    const html = await res.text();
    return html.includes("Tomavine");
  } catch {
    return false;
  }
}

let base;
let baseNote = "";
if (explicit) {
  base = explicit.replace(/\/+$/, "");
} else {
  const candidates = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];
  base = candidates[0];
  let found = false;
  for (const c of candidates) {
    if (await isTomavine(c)) {
      base = c;
      found = true;
      if (c !== candidates[0]) {
        baseNote = "  (auto-detected — 3000 busy or another app)";
      }
      break;
    }
  }
  if (!found) {
    baseNote = "  (no Tomavine dev server found on 3000–3002)";
  }
}

let pass = 0;
let fail = 0;

async function probe(name, path, expect, read) {
  try {
    const res = await fetch(base + path);
    let detail = "";
    if (read) {
      try {
        detail = " - " + String(read(await res.json()));
      } catch {
        detail = " - (body was not JSON)";
      }
    }
    if (res.status === expect) {
      pass += 1;
      console.log("PASS  " + name + " (" + res.status + ")" + detail);
      return true;
    }
    fail += 1;
    console.log("FAIL  " + name + " - expected " + expect + ", got " + res.status + detail);
    return false;
  } catch {
    fail += 1;
    console.log("FAIL  " + name + " - could not reach " + base + path + " (server not running, or Neon asleep - wait 15s and retry)");
    return false;
  }
}

console.log("Tomavine smoke probes - " + base + baseNote);
console.log("");

await probe("Landing page", "/", 200);
await probe("Login page", "/login", 200);
await probe("Rescue page", "/shop/rescue", 200);
await probe("Nurseries page", "/shop/nurseries", 200);
await probe("Advisor page", "/shop/advisor", 200);
await probe("Session probe", "/api/auth/me", 200, (d) => (d && d.user ? "logged in as " + d.user.phone : "not logged in"));
await probe("Taxonomy", "/api/catalog/taxonomy?kind=saplingVariety", 200, (d) =>
  d ? (d.terms ? d.terms.length : "?") + " terms / " + (d.kinds ? d.kinds.length : "?") + " kinds (expect 60 / 5)" : "no body"
);

let firstProduct = null;
if (await probe("Product catalog", "/api/catalog/products", 200, (d) => (d && Array.isArray(d.products) ? d.products.length + " products" : "no list"))) {
  try {
    const res = await fetch(base + "/api/catalog/products");
    const data = await res.json();
    firstProduct = Array.isArray(data.products) && data.products.length > 0 ? data.products[0] : null;
  } catch {
    firstProduct = null;
  }
}

let firstNursery = null;
if (await probe("Nursery catalog", "/api/catalog/nurseries", 200, (d) => (d && Array.isArray(d.nurseries) ? d.nurseries.length + " nurseries" : "no list"))) {
  try {
    const res = await fetch(base + "/api/catalog/nurseries");
    const data = await res.json();
    firstNursery = Array.isArray(data.nurseries) && data.nurseries.length > 0 ? data.nurseries[0] : null;
  } catch {
    firstNursery = null;
  }
}

if (firstProduct && firstProduct.id) {
  await probe("Product page (deep)", "/shop/product/" + firstProduct.id, 200);
} else {
  console.log("SKIP  Product page - no products in catalog");
}
if (firstNursery && firstNursery.slug) {
  await probe("Nursery page (deep)", "/shop/nursery/" + firstNursery.slug, 200);
} else {
  console.log("SKIP  Nursery page - no nurseries in catalog");
}

console.log("");
if (fail === 0) {
  console.log("All " + pass + " probes passed.");
} else {
  console.log(fail + " probe(s) FAILED - paste this output before touching anything.");
}
process.exit(fail === 0 ? 0 : 1);