// Client-safe care-guidance helpers (v1 — deterministic, no AI).
// Product.care holds flat strings from the seller ({sun, soil, water});
// category defaults fill missing keys for plants and saplings only.
// Pots, inputs and tools never show care (nothing to keep alive).

export type CareChip = { icon: string; labelKey: string; value: string };

const CARE_DEFAULTS: Record<string, Record<string, string>> = {
  plants: {
    sun: "Bright indirect light",
    water: "Water when the topsoil feels dry",
    soil: "Well-draining potting mix",
  },
  saplings: {
    sun: "Full sun",
    water: "Keep soil moist — water daily",
    soil: "Well-drained, fertile soil",
  },
};

const CARE_KEYS: { key: "sun" | "water" | "soil"; icon: string }[] = [
  { key: "sun", icon: "☀️" },
  { key: "water", icon: "💧" },
  { key: "soil", icon: "🪴" },
];

export function careChips(care: unknown, category: string): CareChip[] {
  const src =
    care !== null && typeof care === "object" && !Array.isArray(care)
      ? (care as Record<string, unknown>)
      : {};
  const defaults = CARE_DEFAULTS[category] ?? {};
  const chips: CareChip[] = [];
  for (const { key, icon } of CARE_KEYS) {
    const own = typeof src[key] === "string" ? (src[key] as string).trim() : "";
    const fallback = typeof defaults[key] === "string" ? defaults[key] : "";
    const value = own.length > 0 ? own : fallback;
    if (value.length > 0) {
      chips.push({ icon: icon, labelKey: "care_" + key, value: value });
    }
  }
  return chips;
}