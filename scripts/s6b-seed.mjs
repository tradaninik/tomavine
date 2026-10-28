// Mission S6-B seed: bulk-first category pivot + demo B2B products.
//
//   node scripts/s6b-seed.mjs            apply the pivot + demo products
//   node scripts/s6b-seed.mjs --remove   remove demo products + RESTORE retail
//
// What the pivot does (ALL data-only, fully reversible):
//   - parks the retail category tops (plants, decor, gifts) via
//     active=false - they vanish from home tiles, browse, search,
//     advisor and the RFQ picker, but their pages and every product
//     row stay intact in the database (flip active back to revive)
//   - parks the retail pot subs (plastic, terracotta, hanging);
//     grow bags + seedling trays stay live for nurseries
//   - renames 4 tops to their B2B display names (6 languages)
//   - re-orders tops bulk-first (saplings, irrigation, inputs,
//     seeds, tools, plant-protection, pots, landscaping)
//   - adds 2 irrigation subs: filters-fittings, pumps
//   - inserts 10 demo B2B products with MOQs, tree-linked via
//     categoryId (names all end in "(S6-B Demo)")
//
// Before the first mutation the exact prior state of every touched
// category row is snapshotted to scripts/.s6b-cat-backup.json;
// --remove restores from it. Demo nurseries/users are the SAME
// fixtures the S6-A seed owns (kaveri-agri-demo / godavari-bio-demo)
// and are never deleted here - use s6-seed.mjs --remove for those.
//
// ASCII only (non-English letters are \uXXXX escapes).

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { loadDbEnv } from "./lib/db-env.mjs";

loadDbEnv();
const prisma = new PrismaClient();

const SELLER1 = "+919000000101";
const SELLER2 = "+919000000102";
const BUYER1 = "+919000000201";
const BUYER2 = "+919000000202";
const NURSERY1 = "kaveri-agri-demo";
const NURSERY2 = "godavari-bio-demo";

const REMOVE = process.argv.includes("--remove");

const BACKUP = new URL("./.s6b-cat-backup.json", import.meta.url);

const CAT_NAMES = {
  "tools": { "en": "Farm tools", "hi": "\u0915\u0943\u0937\u093f \u0914\u091c\u093c\u093e\u0930", "te": "\u0c35\u0c4d\u0c2f\u0c35\u0c38\u0c3e\u0c2f \u0c2a\u0c28\u0c3f\u0c2e\u0c41\u0c1f\u0c4d\u0c32\u0c41", "kn": "\u0c95\u0cc3\u0cb7\u0cbf \u0c89\u0caa\u0c95\u0cb0\u0ca3\u0c97\u0cb3\u0cc1", "ta": "\u0bb5\u0bbf\u0bb5\u0b9a\u0bbe\u0baf \u0b95\u0bb0\u0bc1\u0bb5\u0bbf\u0b95\u0bb3\u0bcd", "mr": "\u0936\u0947\u0924\u0940 \u0938\u093e\u0927\u0928\u0947" },
  "pots": { "en": "Pots & grow bags", "hi": "\u0917\u092e\u0932\u0947 \u0914\u0930 \u0917\u094d\u0930\u094b \u092c\u0948\u0917", "te": "\u0c15\u0c41\u0c02\u0c21\u0c32\u0c41 \u0c2e\u0c30\u0c3f\u0c2f\u0c41 \u0c17\u0c4d\u0c30\u0c4b \u0c2c\u0c4d\u0c2f\u0c3e\u0c17\u0c4d\u200c\u0c32\u0c41", "kn": "\u0cae\u0ca1\u0c95\u0cc6\u0c97\u0cb3\u0cc1 \u0cae\u0ca4\u0ccd\u0ca4\u0cc1 \u0c97\u0ccd\u0cb0\u0ccb \u0cac\u0ccd\u0caf\u0cbe\u0c97\u0ccd", "ta": "\u0b9a\u0b9f\u0bcd\u0b9f\u0bbf\u0b95\u0bb3\u0bcd \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0b95\u0bcd\u0bb0\u0bcb \u0baa\u0bc8\u0b95\u0bb3\u0bcd", "mr": "\u0917\u092e\u0932\u0947 \u0935 \u0917\u094d\u0930\u094b \u092c\u0945\u0917" },
  "plant-protection": { "en": "Crop protection", "hi": "\u092b\u0938\u0932 \u0938\u0941\u0930\u0915\u094d\u0937\u093e", "te": "\u0c2a\u0c02\u0c1f \u0c30\u0c15\u0c4d\u0c37\u0c23", "kn": "\u0cac\u0cc6\u0cb3\u0cc6 \u0cb0\u0c95\u0ccd\u0cb7\u0ca3\u0cc6", "ta": "\u0baa\u0baf\u0bbf\u0bb0\u0bcd \u0baa\u0bbe\u0ba4\u0bc1\u0b95\u0bbe\u0baa\u0bcd\u0baa\u0bc1", "mr": "\u092a\u0940\u0915 \u0938\u0902\u0930\u0915\u094d\u0937\u0923" },
  "irrigation": { "en": "Irrigation", "hi": "\u0938\u093f\u0902\u091a\u093e\u0908", "te": "\u0c28\u0c40\u0c1f\u0c3f \u0c2a\u0c3e\u0c30\u0c41\u0c26\u0c32", "kn": "\u0ca8\u0cc0\u0cb0\u0cbe\u0cb5\u0cb0\u0cbf", "ta": "\u0baa\u0bbe\u0b9a\u0ba9\u0bae\u0bcd", "mr": "\u0938\u093f\u0902\u091a\u0928" },
  "filters-fittings": { "en": "Filters & fittings", "hi": "\u092b\u093c\u093f\u0932\u094d\u091f\u0930 \u0914\u0930 \u092b\u093f\u091f\u093f\u0902\u0917", "te": "\u0c2b\u0c3f\u0c32\u0c4d\u0c1f\u0c30\u0c4d\u200c\u0c32\u0c41 \u0c2e\u0c30\u0c3f\u0c2f\u0c41 \u0c2b\u0c3f\u0c1f\u0c4d\u0c1f\u0c3f\u0c02\u0c17\u0c4d\u200c\u0c32\u0c41", "kn": "\u0cab\u0cbf\u0cb2\u0ccd\u0c9f\u0cb0\u0ccd\u200c\u0c97\u0cb3\u0cc1 \u0cae\u0ca4\u0ccd\u0ca4\u0cc1 \u0cab\u0cbf\u0c9f\u0cbf\u0c82\u0c97\u0ccd\u200c\u0c97\u0cb3\u0cc1", "ta": "\u0bb5\u0b9f\u0bbf\u0b95\u0b9f\u0bcd\u0b9f\u0bbf\u0b95\u0bb3\u0bcd \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0baa\u0bbe\u0b95\u0b99\u0bcd\u0b95\u0bb3\u0bcd", "mr": "\u092b\u093f\u0932\u094d\u091f\u0930 \u0935 \u092b\u093f\u091f\u093f\u0902\u0917\u094d\u091c" },
  "pumps": { "en": "Pumps", "hi": "\u092a\u0902\u092a", "te": "\u0c2a\u0c02\u0c2a\u0c41\u0c32\u0c41", "kn": "\u0caa\u0c82\u0caa\u0ccd\u200c\u0c97\u0cb3\u0cc1", "ta": "\u0baa\u0bae\u0bcd\u0baa\u0bc1\u0b95\u0bb3\u0bcd", "mr": "\u092a\u0902\u092a" },
};

// Touched category rows (tops + subs) - snapshot keys.
const HIDE_TOPS = ["plants", "decor", "gifts"];
const HIDE_SUBS = ["plastic", "terracotta", "hanging"];
const RENAME_TOPS = ["tools", "pots", "plant-protection", "irrigation"];
const ORDER_TOPS = [
  "saplings",
  "irrigation",
  "inputs",
  "seeds",
  "tools",
  "plant-protection",
  "pots",
  "landscaping",
];
const NEW_SUBS = [
  { slug: "filters-fittings", parent: "irrigation", sortOrder: 40 },
  { slug: "pumps", parent: "irrigation", sortOrder: 50 },
];

const DEMO_NAMES = [
  "Impact Sprinkler 2 inch - 3 Head Set (S6-B Demo)",
  "Screen Filter 2 inch - Disc Type (S6-B Demo)",
  "HDPE Pipe 63 mm - 30 m Coil (S6-B Demo)",
  "Drip Kit - 1 Acre Orchards (S6-B Demo)",
  "Knapsack Sprayer 16 L (S6-B Demo)",
  "Shade Net 50 percent - 3 m x 50 m (S6-B Demo)",
  "Yellow Sticky Traps - Pack of 25 (S6-B Demo)",
  "HDPE Grow Bag 12 x 12 inch (S6-B Demo)",
  "Seedling Tray 98 Cells (S6-B Demo)",
  "Teak Sapling - 1 Year (S6-B Demo)",
];

async function snapshotCategories() {
  if (existsSync(BACKUP)) {
    return;
  }
  const slugs = [...HIDE_TOPS, ...HIDE_SUBS, ...RENAME_TOPS, ...ORDER_TOPS];
  const rows = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, active: true, names: true, sortOrder: true },
  });
  writeFileSync(BACKUP, JSON.stringify({ rows: rows }, null, 2));
  console.log("  snapshot of " + rows.length + " category rows -> scripts/.s6b-cat-backup.json");
}

async function removeDemo() {
  console.log("Removing S6-B demo products...");
  const gone = await prisma.product.deleteMany({ where: { nameEn: { in: DEMO_NAMES } } });
  console.log("  deleted " + gone.count + " demo products");

  console.log("Removing the 2 new irrigation subs...");
  await prisma.category.deleteMany({ where: { slug: { in: NEW_SUBS.map((s) => s.slug) } } });

  console.log("Restoring retail categories...");
  if (existsSync(BACKUP)) {
    const snap = JSON.parse(readFileSync(BACKUP, "utf8"));
    for (const row of snap.rows) {
      await prisma.category.update({
        where: { slug: row.slug },
        data: { active: row.active, names: row.names, sortOrder: row.sortOrder },
      });
    }
    console.log("  restored " + snap.rows.length + " rows from the snapshot (names/order/flags)");
  } else {
    // Best effort without a snapshot.
    for (const slug of HIDE_TOPS) {
      await prisma.category.update({ where: { slug: slug }, data: { active: true } });
    }
    for (const slug of HIDE_SUBS) {
      await prisma.category.update({ where: { slug: slug }, data: { active: true } });
    }
    console.log("  NOTE: no snapshot found - re-activated flags only; display names keep the B2B renames");
  }
  console.log("S6-B pivot removed. (Demo nurseries/users are owned by s6-seed.mjs - untouched.)");
}

async function seedDemo() {
  console.log("Seeding demo users (shared S6-A fixtures, upsert)...");

  const mkUser = (phone, name, role, city, pincode) =>
    prisma.user.upsert({
      where: { phone: phone },
      update: { name: name },
      create: { phone: phone, name: name, role: role, city: city, pincode: pincode },
    });

  const seller1 = await mkUser(SELLER1, "Ramesh Reddy (Demo)", "SELLER", "Kurnool", "518001");
  const seller2 = await mkUser(SELLER2, "Lakshmi Devi (Demo)", "SELLER", "Rajahmundry", "533101");
  await mkUser(BUYER1, "Green Fields Farm", "CUSTOMER", "Kurnool", "518001");
  await mkUser(BUYER2, "Sri Vidya Plantations", "CUSTOMER", "Rajahmundry", "533101");

  console.log("Seeding demo supplier nurseries (shared S6-A fixtures, upsert)...");

  const kaveri = await prisma.nursery.upsert({
    where: { slug: NURSERY1 },
    update: { name: "Kaveri Agri Supplies (Demo)", status: "VERIFIED" },
    create: {
      ownerId: seller1.id,
      name: "Kaveri Agri Supplies (Demo)",
      slug: NURSERY1,
      phone: SELLER1,
      gstin: "37ABCDE1234F1Z5",
      city: "Kurnool",
      area: "Nandikotkur Road",
      pincode: "518001",
      scope: "STATE",
      bulkOk: true,
      retailOk: true,
      status: "VERIFIED",
      physVerifiedAt: new Date(),
      growArea: "12 acres of shade houses and open beds",
      ratingAvg: 4.5,
    },
  });

  const godavari = await prisma.nursery.upsert({
    where: { slug: NURSERY2 },
    update: { name: "Godavari Bio Inputs (Demo)", status: "VERIFIED" },
    create: {
      ownerId: seller2.id,
      name: "Godavari Bio Inputs (Demo)",
      slug: NURSERY2,
      phone: SELLER2,
      gstin: "36ABCDE5678F1Z2",
      city: "Rajahmundry",
      area: "Kadiyam nursery belt",
      pincode: "533101",
      scope: "STATE",
      bulkOk: true,
      retailOk: true,
      status: "VERIFIED",
      physVerifiedAt: new Date(),
      growArea: "Vermy beds and packing shed on 3 acres",
      ratingAvg: 4.4,
    },
  });

  console.log("Applying the bulk-first category pivot...");
  await snapshotCategories();

  for (const slug of HIDE_TOPS) {
    await prisma.category.update({ where: { slug: slug }, data: { active: false } });
    console.log("  parked top: " + slug);
  }
  for (const slug of HIDE_SUBS) {
    await prisma.category.update({ where: { slug: slug }, data: { active: false } });
    console.log("  parked sub: " + slug);
  }
  for (const slug of RENAME_TOPS) {
    await prisma.category.update({ where: { slug: slug }, data: { names: CAT_NAMES[slug] } });
    console.log("  renamed top: " + slug + " -> " + CAT_NAMES[slug].en);
  }
  for (const [i, slug] of ORDER_TOPS.entries()) {
    await prisma.category.update({ where: { slug: slug }, data: { sortOrder: (i + 1) * 10 } });
  }
  console.log("  re-ordered tops: " + ORDER_TOPS.join(", "));

  const irrigation = await prisma.category.findUnique({ where: { slug: "irrigation" } });
  for (const sub of NEW_SUBS) {
    if (irrigation === null) {
      console.log("  NOTE: irrigation top missing - skipped new sub " + sub.slug);
      continue;
    }
    await prisma.category.upsert({
      where: { slug: sub.slug },
      update: { parentId: irrigation.id, names: CAT_NAMES[sub.slug], sortOrder: sub.sortOrder },
      create: {
        slug: sub.slug,
        parentId: irrigation.id,
        names: CAT_NAMES[sub.slug],
        gstRate: null,
        legacyKey: null,
        sortOrder: sub.sortOrder,
      },
    });
    console.log("  ensured sub: irrigation/" + sub.slug + " - " + CAT_NAMES[sub.slug].en);
  }

  console.log("Seeding S6-B demo products (MOQ + tree-linked)...");
  // Re-run safety: delete any previous copies first.
  await prisma.product.deleteMany({ where: { nameEn: { in: DEMO_NAMES } } });

  const products = [
    {
      n: godavari, top: "irrigation", sub: "sprinklers",
      name: "Impact Sprinkler 2 inch - 3 Head Set (S6-B Demo)",
      bot: null, img: "/photos/hero-farm.jpg",
      moq: 2, price: 1850, mrp: 2300, stock: 80,
      prov: { includes: "3 impact heads, riser pipe, stand, couplers" },
    },
    {
      n: godavari, top: "irrigation", sub: "filters-fittings",
      name: "Screen Filter 2 inch - Disc Type (S6-B Demo)",
      bot: null, img: "/photos/hero-farm.jpg",
      moq: 4, price: 640, mrp: 800, stock: 150,
    },
    {
      n: kaveri, top: "irrigation", sub: "hoses-fittings",
      name: "HDPE Pipe 63 mm - 30 m Coil (S6-B Demo)",
      bot: null, img: "/photos/hero-farm.jpg",
      moq: 3, price: 2100, mrp: 2600, stock: 120,
    },
    {
      n: godavari, top: "irrigation", sub: "drip-kits",
      name: "Drip Kit - 1 Acre Orchards (S6-B Demo)",
      bot: null, img: "/photos/hero-farm.jpg",
      moq: 1, price: 14500, mrp: 17500, stock: 30,
      badges: ["kit"],
      prov: { includes: "Laterals, PC emitters, filter, submain, fittings, layout guide" },
    },
    {
      n: kaveri, top: "tools", sub: "hand",
      name: "Knapsack Sprayer 16 L (S6-B Demo)",
      bot: null, img: "/photos/cat-tools.jpg",
      moq: 5, price: 1650, mrp: 2000, stock: 100,
    },
    {
      n: godavari, top: "plant-protection", sub: null,
      name: "Shade Net 50 percent - 3 m x 50 m (S6-B Demo)",
      bot: null, img: "/photos/cat-inputs.jpg",
      moq: 2, price: 3200, mrp: 3900, stock: 60,
    },
    {
      n: godavari, top: "plant-protection", sub: "pest-traps",
      name: "Yellow Sticky Traps - Pack of 25 (S6-B Demo)",
      bot: null, img: "/photos/cat-inputs.jpg",
      moq: 8, price: 180, mrp: 240, stock: 300,
      badges: ["bio-control"],
    },
    {
      n: kaveri, top: "pots", sub: "growbags",
      name: "HDPE Grow Bag 12 x 12 inch (S6-B Demo)",
      bot: null, img: "/photos/cat-pots.jpg",
      moq: 100, price: 14, mrp: 20, stock: 5000,
    },
    {
      n: kaveri, top: "pots", sub: "trays",
      name: "Seedling Tray 98 Cells (S6-B Demo)",
      bot: null, img: "/photos/cat-pots.jpg",
      moq: 50, price: 58, mrp: 75, stock: 1000,
    },
    {
      n: kaveri, top: "saplings", sub: "forestry",
      name: "Teak Sapling - 1 Year (S6-B Demo)",
      bot: "Tectona grandis", img: "/photos/teak.jpg",
      moq: 200, price: 22, mrp: 30, stock: 10000,
      agri: { season: "Jun-Jul", spacing: "3 m x 3 m", guidance: "About 440 stems per acre at this spacing. Plant with the first monsoon showers." },
    },
  ];

  let linked = 0;
  for (const p of products) {
    const topNode = await prisma.category.findUnique({ where: { slug: p.top }, select: { id: true, legacyKey: true } });
    const subNode = p.sub === null ? null : await prisma.category.findUnique({ where: { slug: p.sub }, select: { id: true } });
    const categoryId = subNode !== null ? subNode.id : topNode !== null ? topNode.id : null;
    if (categoryId !== null) {
      linked += 1;
    } else {
      console.log("  NOTE: no tree node for " + p.top + "/" + String(p.sub) + " - " + p.name + " lists via the legacy string only");
    }
    await prisma.product.create({
      data: {
        nurseryId: p.n.id,
        category: topNode !== null ? (topNode.legacyKey ?? p.top) : p.top,
        categoryId: categoryId,
        subCategory: p.sub,
        nameEn: p.name,
        botanical: p.bot,
        image: p.img,
        badges: p.badges ?? null,
        agri: p.agri ?? null,
        provenance: p.prov ?? null,
        moq: p.moq,
        priceMin: p.price,
        mrp: p.mrp,
        stock: p.stock,
      },
    });
  }
  console.log("  " + products.length + " products (" + linked + " tree-linked)");

  console.log("");
  console.log("Active top categories after the pivot:");
  const tops = await prisma.category.findMany({
    where: { parentId: null, active: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, names: true, emoji: true, sortOrder: true, _count: { select: { children: true } } },
  });
  for (const t of tops) {
    const nm = t.names && typeof t.names === "object" ? t.names : {};
    const en = typeof nm.en === "string" && nm.en.length > 0 ? nm.en : t.slug;
    console.log("  " + String(t.sortOrder ?? 0).padStart(2) + "  " + t.slug + " - " + en + " (" + t._count.children + " subs)");
  }
  console.log("");
  console.log("Parked (inactive): " + [...HIDE_TOPS, ...HIDE_SUBS].join(", "));
  console.log("");
  console.log("Done. Browse /shop/c/saplings, /shop/c/irrigation, /shop/c/tools and the homepage.");
  console.log("Undo everything with: node scripts/s6b-seed.mjs --remove");
}

if (REMOVE) {
  await removeDemo();
} else {
  await seedDemo();
}

await prisma.$disconnect();
