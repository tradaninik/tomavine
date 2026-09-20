import type { TaxonomySeedTerm } from "./taxonomy";

// ─────────────────────────────────────────────────────────────
// Default taxonomy catalog — part 2: sapling varieties.
// Flagship entries ship now (full per-acre meta); the complete
// variety list lands in the next batch and self-seeds.
// meta.plantsPerAcre values are typical advisory figures —
// sellers can always adjust before saving a product.
// ─────────────────────────────────────────────────────────────

export const TAXONOMY_SEED_CROPS: TaxonomySeedTerm[] = [
  {
    kind: "saplingVariety",
    label: "Byadgi Kaddi",
    groupName: "Chilli",
    note: "Karnataka's wrinkled paprika-type red; earns an ASTA colour premium.",
    meta: {
      spacing: "60 cm × 45 cm",
      plantsPerAcre: 15000,
      season: "Jun–Aug · Jan–Feb",
      traySize: "104-cell tray",
    },
  },
  {
    kind: "saplingVariety",
    label: "Guntur Sannam (334)",
    groupName: "Chilli",
    note: "Andhra's pungent workhorse dried chilli.",
    meta: {
      spacing: "60 cm × 30 cm",
      plantsPerAcre: 22500,
      season: "Jun–Jul · Oct–Nov",
      traySize: "98-cell tray",
    },
  },
  {
    kind: "saplingVariety",
    label: "Grand Naine G9",
    groupName: "Banana (tissue culture)",
    note: "The world's dominant Cavendish; bunches in 11–13 months.",
    meta: {
      spacing: "1.8 m × 1.8 m (6' × 6')",
      plantsPerAcre: 1210,
      season: "Monsoon best; avoid peak winter",
      form: "Tissue-culture plantlet, hardened",
    },
  },
  {
    kind: "saplingVariety",
    label: "Alphonso (Hapus)",
    groupName: "Mango grafts",
    note: "The king of mangoes; coastal and Deccan grown.",
    meta: {
      spacing: "10 m × 10 m",
      plantsPerAcre: 40,
      spacingHighDensity: "5 m × 5 m",
      plantsPerAcreHighDensity: 160,
      season: "Jun–Aug",
      form: "Soft-wood graft, polybag",
    },
  },
  {
    kind: "saplingVariety",
    label: "Red Lady 786",
    groupName: "Papaya",
    note: "Dwarf Taiwan-type; first fruits 8–10 months from planting.",
    meta: {
      spacing: "1.8 m × 1.8 m",
      plantsPerAcre: 1210,
      season: "Feb–Mar · Sep–Oct",
      form: "Seedling, polybag",
    },
  },
  {
    kind: "saplingVariety",
    label: "PKM-1 (perennial moringa)",
    groupName: "Plantation, spices & forestry",
    note: "Annual-type drumstick bred for pod yield.",
    meta: {
      spacing: "3 m × 3 m",
      plantsPerAcre: 450,
      season: "Jun–Jul",
      form: "Seedling, polybag",
    },
  },
  {
    kind: "saplingVariety",
    label: "Teak (Tectona grandis)",
    groupName: "Plantation, spices & forestry",
    note: "Premium timber on a 20–25 year rotation.",
    meta: {
      spacing: "2 m × 2 m, thinned later",
      plantsPerAcre: 1000,
      season: "Jun–Aug with first rains",
      form: "Polybag seedling or stump",
    },
  },
];