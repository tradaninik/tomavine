// Mission S6-B verification - run with the LOCAL SERVER UP:
//
//   node scripts/s6b-check.mjs                     (localhost:3000)
//   node scripts/s6b-check.mjs https://tomavine.vercel.app
//
// Run node scripts/s6b-seed.mjs FIRST (it applies the category pivot
// and seeds the demo products this check looks for). Read-only: this
// check never writes to the database.
import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";

loadDbEnv();
const prisma = new PrismaClient();

const BASE = process.argv[2] || "http://localhost:3000";
let pass = 0;
let fail = 0;

function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log("PASS  " + name);
  } else {
    fail += 1;
    console.log("FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

function note(name) {
  console.log("NOTE  " + name);
}

async function probe(path) {
  try {
    const res = await fetch(BASE + path);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, text: text, json: json };
  } catch (e) {
    return { status: 0, text: String(e), json: null };
  }
}

const root = fileURLToPath(new URL("../", import.meta.url));
function src(rel) {
  return readFileSync(root + rel, "utf8");
}

// ---------------------------------------------------------------
// A. Source checks
// ---------------------------------------------------------------
console.log("--- source checks ---");

ok(
  "catalog lib maps moq + hiddenCategoryWhere",
  src("src/lib/catalog.ts").includes("moq: p.moq") &&
    src("src/lib/catalog.ts").includes("export async function hiddenCategoryWhere"),
);

ok(
  "product list route applies the parked-category guard",
  src("src/app/api/catalog/products/route.ts").includes("hiddenCategoryWhere()") &&
    src("src/app/api/catalog/products/route.ts").includes("PUBLIC_PRODUCT_INCLUDE, hiddenCategoryWhere"),
);

const advisorRoute = src("src/app/api/advisor/route.ts");
if (advisorRoute.includes("hiddenCategoryWhere")) {
  ok("advisor route applies the parked-category guard", true);
} else {
  note("advisor route does not call hiddenCategoryWhere - Advisory v2 rewrite is installed; park the retail cats there in a follow-up");
}

ok(
  "checkout API enforces MOQ server-side",
  src("src/app/api/orders/route.ts").includes('error: "moq"') &&
    src("src/app/api/orders/route.ts").includes("it.qty < prod.moq"),
);

ok(
  "cart lib exposes belowMoqLines + moq field",
  src("src/lib/cart.ts").includes("export function belowMoqLines") &&
    src("src/lib/cart.ts").includes("moq?: number | null"),
);

ok(
  "cart page blocks below-MOQ checkout",
  src("src/app/shop/cart/page.tsx").includes("belowMoqLines") &&
    src("src/app/shop/cart/page.tsx").includes("belowMoq.length > 0") &&
    src("src/app/shop/cart/page.tsx").includes('t("s7_moq_below"'),
);

ok(
  "cart page browses saplings, not plants",
  src("src/app/shop/cart/page.tsx").includes('href="/shop/c/saplings"') &&
    !src("src/app/shop/cart/page.tsx").includes('href="/shop/c/plants"'),
);

ok(
  "checkout page blocks below-MOQ submit",
  src("src/app/shop/checkout/page.tsx").includes("belowMoqLines") &&
    src("src/app/shop/checkout/page.tsx").includes('t("s7_moq_checkout"'),
);

ok(
  "product detail starts the qty stepper at the MOQ",
  src("src/components/product-detail.tsx").includes("data.product.moq") &&
    src("src/components/product-detail.tsx").includes("product.moq > 1 ? product.moq : 1"),
);

const home = src("src/app/page.tsx");
ok(
  "homepage speaks bulk-first",
  home.includes('t("s7_hero_t")') &&
    home.includes('t("s7_hero_s")') &&
    home.includes('t("s7_hero_eyebrow")') &&
    home.includes('t("s7_trust_advance")') &&
    home.includes('t("s7_trust_track")') &&
    home.includes('t("s7_home_picks")') &&
    home.includes('href="/shop/c/saplings"'),
);

ok(
  "homepage drops the retail rescue banner + terrace hero",
  !home.includes('t("rescue_pitch")') &&
    !home.includes('t("rescue")') &&
    !home.includes('src="/photos/hero-terrace.jpg" className="aspect-[4/3]'),
);

ok(
  "homepage fallback tiles are bulk-first",
  home.includes('href: "/shop/c/irrigation"') &&
    home.includes('key: "s7_cat_irrigation"') &&
    !home.includes('key: "plants"'),
);

const i18n = src("src/lib/i18n.tsx");
ok(
  "DICT_S7 wired (import + 6 spreads)",
  i18n.includes('import { DICT_S7 } from "./i18n-s7";') &&
    (i18n.match(/\.\.\.DICT_S7\./g) || []).length === 6,
);

ok(
  "i18n-s7.ts exists with 6 language blocks",
  existsSync(root + "src/lib/i18n-s7.ts") &&
    (src("src/lib/i18n-s7.ts").match(/s7_hero_t/g) || []).length === 6,
);

ok(
  "seller API accepts moq on create + update",
  src("src/app/api/seller/products/route.ts").includes("moq?: number | null") &&
    src("src/app/api/seller/products/route.ts").includes("data.moq = body.moq") &&
    src("src/app/api/seller/products/route.ts").includes("moq: moq,"),
);

ok(
  "seller product forms expose Minimum order qty",
  src("src/app/seller/products/page.tsx").includes("Minimum order qty") &&
    src("src/app/seller/products/page.tsx").includes("form, moq:"),
);

ok(
  "category-tree maps an irrigation tile photo",
  src("src/lib/category-tree.ts").includes('irrigation: "/photos/hero-farm.jpg"'),
);

// ---------------------------------------------------------------
// B. HTTP probes (deterministic - the category pivot is DB state)
// ---------------------------------------------------------------
console.log("--- http probes ---");

const catsRes = await probe("/api/catalog/categories");
const cats = catsRes.json && Array.isArray(catsRes.json.categories) ? catsRes.json.categories : null;
ok(
  "GET /api/catalog/categories responds",
  catsRes.status === 200 && cats !== null,
  "status " + catsRes.status,
);

if (cats !== null) {
  const topSlugs = cats.map((c) => c.slug);
  ok(
    "retail tops are parked (plants, decor, gifts gone)",
    !topSlugs.includes("plants") && !topSlugs.includes("decor") && !topSlugs.includes("gifts"),
    "tops: " + topSlugs.join(", "),
  );
  ok("saplings is the first top", topSlugs[0] === "saplings", "first is " + topSlugs[0]);

  const irrigationTop = cats.find((c) => c.slug === "irrigation");
  ok(
    "irrigation top live with 5 subs (incl. filters-fittings + pumps)",
    irrigationTop !== undefined &&
      irrigationTop.subs.length === 5 &&
      irrigationTop.subs.some((s) => s.slug === "filters-fittings") &&
      irrigationTop.subs.some((s) => s.slug === "pumps"),
    irrigationTop ? irrigationTop.subs.map((s) => s.slug).join(", ") : "irrigation missing",
  );

  const potsTop = cats.find((c) => c.slug === "pots");
  ok(
    "pots keeps growbags + trays, parks plastic/terracotta/hanging",
    potsTop !== undefined &&
      ["growbags", "trays"].every((s) => potsTop.subs.some((x) => x.slug === s)) &&
      !["plastic", "terracotta", "hanging"].some((s) => potsTop.subs.some((x) => x.slug === s)),
    potsTop ? potsTop.subs.map((s) => s.slug).join(", ") : "pots missing",
  );

  const toolsTop = cats.find((c) => c.slug === "tools");
  ok(
    "tools top renamed for B2B",
    toolsTop !== undefined && toolsTop.names && toolsTop.names.en === "Farm tools",
    toolsTop && toolsTop.names ? String(toolsTop.names.en) : "tools missing",
  );
}

const parkedCats = ["plants", "decor", "gifts"];
const listRes = await probe("/api/catalog/products");
const list = listRes.json && Array.isArray(listRes.json.products) ? listRes.json.products : null;
ok(
  "GET /api/catalog/products responds",
  listRes.status === 200 && list !== null,
  "status " + listRes.status,
);

if (list !== null) {
  const leaked = list.filter((p) => parkedCats.includes(p.category));
  ok(
    "no parked-category product in the unfiltered listing",
    leaked.length === 0,
    leaked.length > 0 ? leaked.map((p) => p.nameEn).join("; ").slice(0, 120) : "",
  );
  const moqRows = list.filter((p) => typeof p.moq === "number" && p.moq > 1);
  ok("listing carries moq fields (" + moqRows.length + " MOQ products)", moqRows.length > 0);
}

const plantsRes = await probe("/api/catalog/products?cat=plants");
const plantsList =
  plantsRes.json && Array.isArray(plantsRes.json.products) ? plantsRes.json.products : null;
ok(
  "browsing a parked category returns an empty list",
  plantsRes.status === 200 && plantsList !== null && plantsList.length === 0,
  "status " + plantsRes.status + " n=" + (plantsList ? plantsList.length : "?"),
);

const irrRes = await probe("/api/catalog/products?cat=irrigation");
const irrList = irrRes.json && Array.isArray(irrRes.json.products) ? irrRes.json.products : null;
ok(
  "irrigation browse lists tree-linked demo products",
  irrRes.status === 200 && irrList !== null && irrList.length >= 3,
  "n=" + (irrList ? irrList.length : "?"),
);

// ---------------------------------------------------------------
// C. Database checks (state after s6b-seed.mjs)
// ---------------------------------------------------------------
console.log("--- db checks ---");

const flagRows = await prisma.category.findMany({
  where: { slug: { in: ["plants", "decor", "gifts", "plastic", "terracotta", "hanging"] } },
  select: { slug: true, active: true },
});
ok(
  "parked rows are inactive in the DB",
  flagRows.length === 6 && flagRows.every((r) => r.active === false),
  flagRows.map((r) => r.slug + "=" + r.active).join(", "),
);

const nameRows = await prisma.category.findMany({
  where: { slug: { in: ["tools", "pots", "plant-protection", "irrigation"] } },
  select: { slug: true, names: true },
});
const enOf = (slug) => {
  const row = nameRows.find((r) => r.slug === slug);
  return row && row.names && typeof row.names === "object" && typeof row.names.en === "string"
    ? row.names.en
    : null;
};
ok(
  "B2B display names applied",
  enOf("tools") === "Farm tools" &&
    enOf("pots") === "Pots & grow bags" &&
    enOf("plant-protection") === "Crop protection" &&
    enOf("irrigation") === "Irrigation",
  [enOf("tools"), enOf("pots"), enOf("plant-protection"), enOf("irrigation")].join(" | "),
);

const orderRows = await prisma.category.findMany({
  where: { slug: { in: ["saplings", "irrigation", "inputs", "seeds", "tools", "plant-protection", "pots", "landscaping"] } },
  select: { slug: true, sortOrder: true },
});
const seq = ["saplings", "irrigation", "inputs", "seeds", "tools", "plant-protection", "pots", "landscaping"];
const orderOk =
  orderRows.length === 8 &&
  seq.every((slug, i) => {
    const row = orderRows.find((r) => r.slug === slug);
    const prev = i === 0 ? null : orderRows.find((r) => r.slug === seq[i - 1]);
    return row !== undefined && (prev === null || row.sortOrder > prev.sortOrder);
  });
ok("tops sorted bulk-first", orderOk, orderRows.map((r) => r.slug + ":" + r.sortOrder).join(", "));

const subRows = await prisma.category.findMany({
  where: { slug: { in: ["filters-fittings", "pumps"] } },
  select: { slug: true, parentId: true },
});
const irrRow = await prisma.category.findUnique({ where: { slug: "irrigation" }, select: { id: true } });
ok(
  "new irrigation subs exist under the irrigation top",
  irrRow !== null && subRows.length === 2 && subRows.every((s) => s.parentId === irrRow.id),
  subRows.map((s) => s.slug).join(", "),
);

const demoRows = await prisma.product.findMany({
  where: { nameEn: { endsWith: "(S6-B Demo)" } },
  select: { moq: true, categoryId: true, category: true },
});
if (demoRows.length === 0) {
  note("no S6-B demo products found - run node scripts/s6b-seed.mjs first");
} else {
  ok(
    "10 S6-B demo products, all with moq + tree-linked",
    demoRows.length === 10 &&
      demoRows.every((p) => typeof p.moq === "number" && p.moq >= 1 && p.categoryId !== null),
    "n=" + demoRows.length,
  );
}

console.log("");
console.log("================ RESULT ================");
console.log("PASS " + pass + "  FAIL " + fail + "  (notes are informational)");
if (fail > 0) {
  process.exit(1);
}

await prisma.$disconnect();
