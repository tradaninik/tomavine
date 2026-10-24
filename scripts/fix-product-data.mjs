// Coordinated product data fixes for the photo round (2026-10).
//
//   node scripts/fix-product-data.mjs
//
// What it does (decisions locked with the team, see worklog):
//   1. RENAME "Lemon grass 1" -> "Lemongrass"
//      (self-serve name artifact: trailing " 1"; URLs use product ids, and
//      past orders keep their own nameSnap, so the rename is safe)
//   2. HIDE "Indoor foliage" (belle-view-nursery, Rs 1/MRP 1 self-serve test
//      listing — reversible: the seller Unhide button or a one-line update)
//   3. PHOTO  Lemongrass -> /photos/lemongrass.jpg  (new repo asset)
//      PHOTO  Jasmine    -> /photos/jasmine.jpg     (new repo asset)
//   4. BOTANICAL Lemongrass -> Cymbopogon citratus
//      BOTANICAL Jasmine    -> Jasminum sambac
//
// Safety:
//   - only UPDATEs matched rows by id — never deletes or creates anything
//   - all matching/decision logic lives in scripts/lib/product-match.mjs
//     (pure, unit-tested offline); this file is just the Prisma executor
//   - idempotent: a second run reports every step as already-done
//   - loud failures: any step that cannot find its product prints the
//     candidate rows and makes the script exit 1 — paste the output back
//
// Ends with a read-only nursery report (slug, status, retailOk, product
// counts) which settles visibility questions like zz-selfserve-test-nursery.

import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";
import { normName, planFixes } from "./lib/product-match.mjs";

loadDbEnv();

const prisma = new PrismaClient();

const TARGETS = {
  rename: { from: "Lemon grass 1", to: "Lemongrass" },
  hide: "Indoor foliage",
  photos: [
    { name: "Lemongrass", image: "/photos/lemongrass.jpg" },
    { name: "Jasmine", image: "/photos/jasmine.jpg" },
  ],
  botanicals: [
    { name: "Lemongrass", botanical: "Cymbopogon citratus" },
    { name: "Jasmine", botanical: "Jasminum sambac" },
  ],
};

async function main() {
  const rows = await prisma.product.findMany({
    select: { id: true, nameEn: true, hidden: true, image: true, botanical: true },
  });
  console.log(`Planning fixes against ${rows.length} product(s)...`);
  console.log("");

  const { ops, failures } = planFixes(rows, TARGETS);
  let applied = 0;

  for (const op of ops) {
    if (op.op === "rename") {
      await prisma.product.update({ where: { id: op.id }, data: { nameEn: op.to } });
      console.log(`  ✔ rename  ${JSON.stringify(op.from)} -> ${JSON.stringify(op.to)} (id ${op.id})`);
      applied++;
    } else if (op.op === "hide") {
      await prisma.product.update({ where: { id: op.id }, data: { hidden: true } });
      console.log(`  ✔ hide    ${JSON.stringify(op.nameEn)} (id ${op.id})`);
      applied++;
    } else if (op.op === "setimage") {
      await prisma.product.update({ where: { id: op.id }, data: { image: op.to } });
      console.log(`  ✔ photo   ${JSON.stringify(op.nameEn)}: ${op.from ?? "none"} -> ${op.to}`);
      applied++;
    } else if (op.op === "setbotanical") {
      await prisma.product.update({ where: { id: op.id }, data: { botanical: op.to } });
      console.log(`  ✔ botany  ${JSON.stringify(op.nameEn)}: ${op.from ?? "none"} -> ${op.to}`);
      applied++;
    } else if (op.op === "already") {
      console.log(`  = already ${op.text}`);
    } else if (op.op === "note") {
      console.log(`  ~ note    ${op.text}`);
    } else if (op.op === "fail") {
      console.log(`  ✗ FAIL    [${op.step}] ${op.note}`);
      for (const c of op.candidates) {
        console.log(`      candidate: ${JSON.stringify(c.nameEn)} (id ${c.id})`);
      }
    }
  }
  console.log("");
  console.log(`${applied} fix(es) applied, ${failures.length} failure(s).`);

  // Verification: re-read the touched products and print their final state.
  const wanted = new Set(
    [TARGETS.rename.to, TARGETS.hide, ...TARGETS.photos.map((p) => p.name), ...TARGETS.botanicals.map((b) => b.name)].map(
      (s) => normName(s),
    ),
  );
  const after = await prisma.product.findMany({
    select: { id: true, nameEn: true, hidden: true, image: true, botanical: true, nursery: { select: { slug: true } } },
    orderBy: { nameEn: "asc" },
  });
  console.log("");
  console.log("Touched products after the run:");
  for (const p of after) {
    if (!wanted.has(normName(p.nameEn))) continue;
    const photo = p.image ? p.image : "(none)";
    const bot = p.botanical ?? "(none)";
    const hid = p.hidden ? ", HIDDEN" : "";
    console.log(`  [${p.nursery.slug}] ${JSON.stringify(p.nameEn)}  photo:${photo}  botanical:${bot}${hid}`);
  }

  // Read-only nursery report: every nursery incl. zero-product ones.
  const nurseries = await prisma.nursery.findMany({
    select: { slug: true, status: true, retailOk: true, image: true },
    orderBy: { slug: "asc" },
  });
  const all = await prisma.product.findMany({
    select: { hidden: true, nursery: { select: { slug: true } } },
  });
  const counts = {};
  for (const p of all) {
    const e = (counts[p.nursery.slug] ??= { total: 0, visible: 0 });
    e.total += 1;
    if (!p.hidden) e.visible += 1;
  }
  console.log("");
  console.log("Nurseries (all, incl. zero-product):");
  for (const n of nurseries) {
    const c = counts[n.slug] ?? { total: 0, visible: 0 };
    const img = n.image ? "yes" : "none";
    console.log(
      `  ${n.slug}  status:${n.status} retailOk:${n.retailOk ? "yes" : "no"}  products:${c.total} (visible ${c.visible})  image:${img}`,
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("NOT DONE — paste this whole output back so the maps can be fixed.");
    process.exitCode = 1;
  } else {
    console.log("");
    console.log("All fixes applied or already in place.");
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
