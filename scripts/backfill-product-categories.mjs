// Backfill Product.categoryId from the new Category tree (phase 2a).
//
//   node scripts/backfill-product-categories.mjs
//
// Two mapping layers, applied in order:
//   1. NAME_MAP: product nameEn -> specific sub ("top/sub"). Matching
//      reuses scripts/lib/product-match.mjs (exact beats loose, loud
//      failures with candidates, never a silent skip).
//   2. Fallback: any product not matched by name gets its TOP by the
//      legacy Product.category string via Category.legacyKey — so every
//      product ends up at least top-level mapped, including future
//      self-serve listings the name map does not know.
//
// Idempotent: a second run reports every product as already-done.
// Only UPDATEs Product.categoryId — never touches the legacy category
// string, subCategory, or anything else.

import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";
import { findCandidates } from "./lib/product-match.mjs";

loadDbEnv();

const prisma = new PrismaClient();

// Exact (or loose-matched) product name -> tree node slug.
const NAME_MAP = {
  "Areca Palm": "plants/palms",
  "Chilli Saplings — Guntur Sannam": "saplings/vegetable",
  "Curry Leaf Plant": "plants/herbs",
  "Garden Hand Tool Set - 5 piece": "tools/hand",
  "Indoor foliage": "plants/indoor",
  "Jade Plant": "plants/succulents",
  "Jasmine": "plants/aromatic",
  "Jeevamrutam — 5 Litre": "inputs/fertilizer",
  "Lemongrass": "plants/aromatic",
  "Terracotta Grow Pot — 10 inch": "pots/terracotta",
  "Tomato Saplings — Arka Abha": "saplings/vegetable",
  "Vermicompost — 10 kg": "inputs/compost",
};

async function main() {
  // Load and index the tree.
  const cats = await prisma.category.findMany({ select: { id: true, slug: true, parentId: true, legacyKey: true } });
  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const byLegacy = new Map(cats.filter((c) => c.legacyKey !== null).map((c) => [c.legacyKey, c]));

  // Validate every NAME_MAP target exists as a sub.
  const badTargets = Object.entries(NAME_MAP)
    .map(([name, slug]) => {
      const node = bySlug.get(slug.split("/")[1] ?? "");
      const top = bySlug.get(slug.split("/")[0]);
      const ok = node && top && node.parentId === top.id;
      return ok ? null : `${JSON.stringify(name)} -> missing/bad slug "${slug}"`;
    })
    .filter(Boolean);
  if (badTargets.length > 0) {
    console.log("NAME_MAP problems (run scripts/seed-categories.mjs first?):");
    for (const b of badTargets) console.log(`  ✗ ${b}`);
    process.exitCode = 1;
    return;
  }

  const targetId = (slug) => bySlug.get(slug.split("/")[1]).id;

  const products = await prisma.product.findMany({
    select: { id: true, nameEn: true, category: true, categoryId: true },
    orderBy: { nameEn: "asc" },
  });
  console.log(`Backfilling ${products.length} product(s)...`);

  const failures = [];
  let applied = 0;
  let already = 0;
  let fallbacks = 0;
  const claimed = new Set(); // product ids matched by NAME_MAP

  // Layer 1: NAME_MAP (same matching discipline as fix-product-data).
  for (const [name, slug] of Object.entries(NAME_MAP)) {
    const res = findCandidates(products, name);
    if (res.ambiguous) {
      failures.push({ name, note: `ambiguous — ${res.matches.length} rows match`, matches: res.matches });
      continue;
    }
    if (res.matches.length === 0) {
      const words = name.toLowerCase().split(" ").filter((w) => w.length >= 4);
      const near = products.filter((p) => words.some((w) => p.nameEn.toLowerCase().includes(w)));
      failures.push({ name, note: "no product matches", matches: near });
      continue;
    }
    const p = res.matches[0];
    claimed.add(p.id);
    const want = targetId(slug);
    if (p.categoryId === want) {
      already += 1;
      console.log(`  = already ${JSON.stringify(p.nameEn)} -> ${slug}`);
    } else {
      await prisma.product.update({ where: { id: p.id }, data: { categoryId: want } });
      applied += 1;
      const was = p.categoryId ? "(re-mapped)" : "";
      console.log(`  ✔ map     ${JSON.stringify(p.nameEn)} -> ${slug} ${was}`);
    }
  }

  // Layer 2: legacy-category fallback for everything else.
  for (const p of products) {
    if (claimed.has(p.id)) continue;
    const top = byLegacy.get(p.category);
    if (!top) {
      failures.push({ name: p.nameEn, note: `legacy category ${JSON.stringify(p.category)} has no tree top`, matches: [p] });
      continue;
    }
    if (p.categoryId === top.id) {
      already += 1;
      continue; // already at top level; a future NAME_MAP entry can refine it
    }
    await prisma.product.update({ where: { id: p.id }, data: { categoryId: top.id } });
    applied += 1;
    fallbacks += 1;
    console.log(`  ~ top     ${JSON.stringify(p.nameEn)} -> ${top.slug} (fallback via legacy "${p.category}")`);
  }

  // Verification read-back.
  const after = await prisma.product.findMany({
    select: { nameEn: true, categoryId: true, categoryNode: { select: { slug: true, parent: { select: { slug: true } } } } },
    orderBy: { nameEn: "asc" },
  });
  const mapped = after.filter((p) => p.categoryId !== null).length;
  const unmapped = after.filter((p) => p.categoryId === null);
  console.log("");
  console.log(`Result: ${mapped}/${after.length} products have categoryId (${applied} set this run, ${already} already done, ${fallbacks} top-level fallbacks).`);
  if (unmapped.length > 0) {
    console.log("Unmapped:");
    for (const p of unmapped) console.log(`  - ${JSON.stringify(p.nameEn)}`);
  }

  if (failures.length > 0) {
    console.log("");
    console.log("FAILURES (paste this output back):");
    for (const f of failures) {
      console.log(`  ✗ [${JSON.stringify(f.name)}] ${f.note}`);
      for (const m of f.matches) console.log(`      candidate: ${JSON.stringify(m.nameEn)}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
