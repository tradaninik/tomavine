// READ-ONLY listing of product names + ids.
//
//   node scripts/list-product-names.mjs
//
// Purpose: capture the EXACT nameEn of every product in the live
// database (e.g. when a name has drifted from the seed data) so
// name-matched update scripts like add-photos.mjs can be fixed.
//
// This script never writes anything — it only prints.

import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Tiny .env loader (no dotenv dependency needed) — same pattern as
// scripts/add-photos.mjs.
if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim();
    }
  }
}

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      nameEn: true,
      category: true,
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
    console.log(`  [${p.nursery.slug}] ${JSON.stringify(p.nameEn)}  (${p.category}${p.hidden ? ", hidden" : ""}) image:${photo}`);
  }
  console.log("");
  console.log("Names are JSON-quoted so trailing spaces / dashes are visible.");
  console.log("Copy the exact name you need into the map in scripts/add-photos.mjs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
