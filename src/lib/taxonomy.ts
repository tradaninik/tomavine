import { db } from "@/lib/db";
import { TAXONOMY_SEED_BASE } from "@/lib/taxonomySeed";
import { TAXONOMY_SEED_CROPS } from "@/lib/taxonomySeedCrops";

// ─────────────────────────────────────────────────────────────
// Tomavine taxonomy — master pick-lists for sellers (soils,
// composts, plant types, sizes, sapling varieties).
//
// SERVER-ONLY MODULE: it imports prisma, so client pages must
// never import from here — they fetch /api/catalog/taxonomy.
// ─────────────────────────────────────────────────────────────

export const TAXONOMY_SEED = [...TAXONOMY_SEED_BASE, ...TAXONOMY_SEED_CROPS];

export type TaxonomySeedTerm = {
  kind: string;
  label: string;
  groupName: string;
  note?: string;
  names?: Record<string, string>;
  meta?: Record<string, unknown>;
};

export type TaxonomyTermDTO = {
  id: string;
  kind: string;
  label: string;
  names: Record<string, string> | null;
  groupName: string | null;
  note: string | null;
  meta: Record<string, unknown> | null;
  sort: number;
  active: boolean;
};

export const TAXONOMY_KINDS = ["soil", "compost", "plantType", "size", "saplingVariety"];

export const KIND_META: Record<string, { label: string; emoji: string; blurb: string; groups: string[] }> = {
  soil: {
    label: "Soils & media",
    emoji: "🪨",
    blurb: "Field soils, potting mixes and soilless amendments.",
    groups: ["Field soils", "Potting mixes", "Amendments & media"],
  },
  compost: {
    label: "Compost & inputs",
    emoji: "🍂",
    blurb: "Composts, cakes, natural-farming liquids and bio inputs.",
    groups: ["Composts & manures", "Cakes & meals", "Natural-farming liquids", "Biofertilizers & biocontrol"],
  },
  plantType: {
    label: "Plant types",
    emoji: "🪴",
    blurb: "What kind of plant a listing is — indoor, flowering, fruit, tree.",
    groups: ["Indoor & foliage", "Flowering", "Succulents & specialty", "Edible & useful", "Trees & landscape"],
  },
  size: {
    label: "Sizes & stages",
    emoji: "📏",
    blurb: "Trade stages (grafted, tissue-culture…) and container sizes.",
    groups: ["Trade stages", "Containers"],
  },
  saplingVariety: {
    label: "Sapling varieties",
    emoji: "🌾",
    blurb: "Crop varieties for farmer saplings, with per-acre guidance.",
    groups: [
      "Tomato",
      "Chilli",
      "Brinjal & okra",
      "Cucurbits",
      "Cole crops & onion",
      "Banana (tissue culture)",
      "Papaya",
      "Mango grafts",
      "Other fruit",
      "Plantation, spices & forestry",
      "Commercial flowers",
    ],
  },
};

export function isTaxonomyKind(value: string): boolean {
  return TAXONOMY_KINDS.includes(value);
}

// How many seed terms exist per kind — used by the lazy seeder.
const SEED_COUNTS: Record<string, number> = {};
for (const term of TAXONOMY_SEED) {
  SEED_COUNTS[term.kind] = (SEED_COUNTS[term.kind] ?? 0) + 1;
}

// In-process flag so a warm server checks the database only once.
let seedChecked = false;

// Lazy, idempotent seeding: if any kind holds fewer rows than the
// default catalog (fresh database — or a future catalog update),
// insert whatever is missing. skipDuplicates keeps concurrent cold
// starts and admin-added terms completely safe.
export async function ensureTaxonomySeeded(): Promise<void> {
  if (seedChecked) {
    return;
  }
  const groups = await db.taxonomyTerm.groupBy({ by: ["kind"], _count: { _all: true } });
  const counts: Record<string, number> = {};
  for (const g of groups) {
    counts[g.kind] = g._count._all;
  }
  const short = Object.entries(SEED_COUNTS).some(([kind, want]) => (counts[kind] ?? 0) < want);
  if (short) {
    await db.taxonomyTerm.createMany({
      data: TAXONOMY_SEED.map((term, i) => ({
        kind: term.kind,
        label: term.label,
        names: term.names ?? undefined,
        groupName: term.groupName,
        note: term.note ?? undefined,
        meta: term.meta ?? undefined,
        sort: i,
      })),
      skipDuplicates: true,
    });
  }
  seedChecked = true;
}