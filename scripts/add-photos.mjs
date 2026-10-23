// One-shot photo enrichment for an EXISTING Tomavine database.
//
//   node scripts/add-photos.mjs
//
// Safe to run on production (Neon): it only UPDATEs image fields matched
// by name/slug — it never deletes or recreates rows, and it is idempotent
// (running twice changes nothing the second time).
//
// Requires DATABASE_URL in .env (same one Vercel uses) and the migration
// `add_nursery_image` applied: npx prisma migrate deploy
//
// Photos live in public/photos/*.jpg so they ship with the app — no blob
// storage, no external CDN dependency, free Vercel edge caching.

import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Tiny .env loader (no dotenv dependency needed).
if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim();
    }
  }
}

const prisma = new PrismaClient();

// product nameEn -> photo (paths are public/photos assets that ship with the repo)
const PRODUCT_PHOTOS = {
  "Chilli Saplings — Guntur Sannam": "/photos/chilli-saplings.jpg",
  "Tomato Saplings — Arka Abha": "/photos/tomato-saplings.jpg",
  "Curry Leaf Plant": "/photos/curry-leaf.jpg",
  "Jade Plant": "/photos/jade-plant.jpg",
  "Areca Palm": "/photos/areca-palm.jpg",
  "Vermicompost — 10 kg": "/photos/vermicompost.jpg",
  "Jeevamrutam — 5 Litre": "/photos/jeevamrutam.jpg",
  "Terracotta Grow Pot — 10 inch": "/photos/terracotta-pot.jpg",
  "Garden Hand Tool Set — 5 pieces": "/photos/tool-set.jpg",
};

// nursery slug -> photo
const NURSERY_PHOTOS = {
  "green-leaf": "/photos/nursery-green-leaf.jpg",
};

async function main() {
  let products = 0;
  let skipped = [];
  for (const [nameEn, image] of Object.entries(PRODUCT_PHOTOS)) {
    const r = await prisma.product.updateMany({ where: { nameEn }, data: { image } });
    if (r.count > 0) {
      products += r.count;
      console.log(`  ✔ ${nameEn} -> ${image}`);
    } else {
      skipped.push(nameEn);
    }
  }

  let nurseries = 0;
  for (const [slug, image] of Object.entries(NURSERY_PHOTOS)) {
    const r = await prisma.nursery.updateMany({ where: { slug }, data: { image } });
    if (r.count > 0) {
      nurseries += r.count;
      console.log(`  ✔ nursery ${slug} -> ${image}`);
    } else {
      skipped.push(`nursery:${slug}`);
    }
  }

  console.log("");
  console.log(`Done. ${products} product(s) + ${nurseries} nursery(ies) got photos.`);
  if (skipped.length > 0) {
    console.log("");
    console.log("No row matched (likely renamed in your DB — safe to ignore or edit map above):");
    for (const s of skipped) console.log(`  - ${s}`);
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
