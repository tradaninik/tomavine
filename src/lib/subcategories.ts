// ─────────────────────────────────────────────────────────────
// Subcategory vocabulary (S9 catalog richness).
// Mirrors the top-level category pattern: a fixed, curated list
// per category, stored on Product.subCategory as a plain slug.
// Subcategories are PRESENTATION vocabulary (browsing sections);
// taxonomy remains the deep vocabulary (varieties, tray sizes).
// Optional at creation; storefront filtering is batch 2.
// ─────────────────────────────────────────────────────────────

export type SubOption = { v: string; label: string };

export const SUBCATEGORIES: Record<string, SubOption[]> = {
  plants: [
    { v: "indoor", label: "Indoor" },
    { v: "flowering", label: "Flowering" },
    { v: "succulents", label: "Succulents & cacti" },
    { v: "herbs", label: "Herbs" },
    { v: "outdoor", label: "Outdoor & landscaping" },
  ],
  saplings: [
    { v: "vegetable", label: "Vegetable saplings" },
    { v: "fruit", label: "Fruit saplings" },
    { v: "flower", label: "Flower saplings" },
    { v: "forestry", label: "Forestry & avenue" },
  ],
  inputs: [
    { v: "soil", label: "Soil & potting mixes" },
    { v: "compost", label: "Compost & manure" },
    { v: "fertilizer", label: "Fertilizers & bio-boosters" },
    { v: "mulch", label: "Mulch" },
    { v: "seeds", label: "Seeds" },
    { v: "pest", label: "Pest & disease care" },
  ],
  pots: [
    { v: "plastic", label: "Plastic pots" },
    { v: "terracotta", label: "Terracotta & ceramic" },
    { v: "growbags", label: "Grow bags" },
    { v: "hanging", label: "Hanging & vertical" },
  ],
  tools: [
    { v: "hand", label: "Hand tools" },
    { v: "watering", label: "Watering" },
    { v: "pruning", label: "Pruning & cutting" },
    { v: "kits", label: "Kits & accessories" },
  ],
};

export function subOptionsFor(category: string): SubOption[] {
  return SUBCATEGORIES[category] ?? [];
}

export function subLabel(category: string, sub: string | null | undefined): string {
  if (!sub) {
    return "";
  }
  return subOptionsFor(category).find((s) => s.v === sub)?.label ?? sub;
}

export function isValidSub(category: string, sub: string): boolean {
  return subOptionsFor(category).some((s) => s.v === sub);
}