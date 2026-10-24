// READ-ONLY listing of product names + ids.
//
//   node scripts/list-product-names.mjs
//
// Purpose: capture the EXACT nameEn of every product in the live
// database (e.g. when a name has drifted from the seed data) so
// name-matched update scripts like add-photos.mjs can be fixed.
// Also prints subCategory, botanical, priceMin/mrp and stock — the
// inputs needed for the category backfill map and photo decisions —
// plus an all-nurseries report (including zero-product nurseries, with
// status/retailOk) to settle visibility questions.
//
// This script never writes anything — it only prints.

import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";

// Shared loader: .env wins over a stray non-postgres shell
// DATABASE_URL, and prints which database is in effect.
loadDbEnv();

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      nameEn: true,
      category: true,
      subCategory: true,
      botanical: true,
      priceMin: true,
      mrp: true,
      stock: true,
      hidden: true,
      image: true,
      nursery: { select: { slug: true } },
    },
    orderBy: [{ nursery: { slug: "asc" } }, { nameEn: "asc" }],
  });

  console.log(`Found ${products.length} product(s):`);
  console.log("");
  for (const p of products) {
    const photo = p.image ? "📷" : "␀";
    const cat = p.subCategory ? `${p.category}/${p.subCategory}` : p.category;
    const hid = p.hidden ? ", hidden" : "";
    const bot = p.botanical ? ` bot:${JSON.stringify(p.botanical)}` : "";
    console.log(
      `  [${p.nursery.slug}] ${JSON.stringify(p.nameEn)}  (${cat}, ${p.priceMin}/${p.mrp}, stock ${p.stock}${hid}) image:${photo}${bot}`,
    );
  }

  // Summary: what the category backfill and photo expansion need
  // to see at a glance (coverage, gaps, hidden strays).
  const byCat = {};
  let withPhoto = 0;
  let hiddenCount = 0;
  const nurserySlugs = new Set();
  for (const p of products) {
    const key = p.subCategory ? `${p.category}/${p.subCategory}` : p.category;
    byCat[key] = (byCat[key] ?? 0) + 1;
    if (p.image) withPhoto += 1;
    if (p.hidden) hiddenCount += 1;
    nurserySlugs.add(p.nursery.slug);
  }

  console.log("");
  console.log("By category (count):");
  for (const [k, v] of Object.entries(byCat).sort()) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("");
  console.log(`Photos: ${withPhoto} of ${products.length} have images, ${products.length - withPhoto} still need one.`);
  console.log(`Hidden: ${hiddenCount}. Nurseries with products: ${nurserySlugs.size} (${[...nurserySlugs].join(", ")}).`);

  // All nurseries (including zero-product ones): status/retailOk decide
  // storefront visibility (VERIFIED + retailOk => products listed), so
  // this table settles questions like zz-selfserve-test-nursery.
  const nurseries = await prisma.nursery.findMany({
    select: { slug: true, status: true, retailOk: true, image: true },
    orderBy: { slug: "asc" },
  });
  const perNursery = {};
  for (const p of products) {
    const e = (perNursery[p.nursery.slug] ??= { total: 0, visible: 0 });
    e.total += 1;
    if (!p.hidden) e.visible += 1;
  }
  console.log("");
  console.log("Nurseries (all, incl. zero-product):");
  for (const n of nurseries) {
    const c = perNursery[n.slug] ?? { total: 0, visible: 0 };
    const img = n.image ? "yes" : "none";
    console.log(
      `  ${n.slug}  status:${n.status} retailOk:${n.retailOk ? "yes" : "no"}  products:${c.total} (visible ${c.visible})  image:${img}`,
    );
  }
  console.log("");
  console.log("Names are JSON-quoted so trailing spaces / dashes are visible.");
  console.log("Line format: (category/subCategory, priceMin/mrp in rupees, stock) image — bot:botanical.");
  console.log("Copy the exact name into the map in scripts/add-photos.mjs (or the category backfill map).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
