// ─────────────────────────────────────────────────────────────
// Nursery franchise features (mission F).
//
// The Quiclo-style opt-in sheet: a fixed set of module/payment
// switches the SUPER_ADMIN flips per nursery ("Modules & payments"
// in the nursery editor). Stored as Nursery.features (Json?):
//
//   null / undefined  → every module ON (default; pre-existing
//                       nurseries keep full access)
//   { cod: false }    → COD off, everything else ON
//
// Only an explicit `false` disables a key. Unknown keys are ignored
// and missing keys read as enabled, so shipping a NEW toggle later
// starts it ON for every existing nursery — no migration needed.
// Malformed values (array, string, number) fail closed? No — they
// fail OPEN to the all-on default, matching how the store means
// "never managed" rather than "sabotaged". Either way the super
// admin re-saves the form to fix it.
// ─────────────────────────────────────────────────────────────

export const NURSERY_FEATURE_KEYS = [
  "products",
  "rescue",
  "subscriptions",
  "cod",
  "online",
  "locations",
] as const;

export type NurseryFeatureKey = (typeof NURSERY_FEATURE_KEYS)[number];

export type NurseryFeatures = Record<NurseryFeatureKey, boolean>;

export const NURSERY_FEATURE_META: Record<
  NurseryFeatureKey,
  { label: string; hint: string; sellerNote: string }
> = {
  products: {
    label: "Plant catalog",
    hint: "Nursery admin can add and edit their own products in the seller console",
    sellerNote: "Add and edit your own plants in this console",
  },
  rescue: {
    label: "Rescue deals",
    hint: "Nursery admin can discount clearance stock on the storefront",
    sellerNote: "Discount clearance stock (rescue deals)",
  },
  subscriptions: {
    label: "Plant-care plans",
    hint: "Nursery can offer recurring care-visit services",
    sellerNote: "Offer recurring plant-care plans",
  },
  cod: {
    label: "Cash on delivery",
    hint: "Buyers can choose COD at checkout for this nursery's cart",
    sellerNote: "Buyers can pay cash on delivery",
  },
  online: {
    label: "Online payments",
    hint: "Buyers can prepay (Razorpay) at checkout for this nursery's cart",
    sellerNote: "Buyers can prepay online (Razorpay)",
  },
  locations: {
    label: "Manage service locations",
    hint: "Nursery admin can add/remove the pincodes they serve from the seller console",
    sellerNote: "Add and remove the pincodes you serve",
  },
};

function isFeatureObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

// Expand the stored JSON into a complete, typed map. Everything the
// switchboard does NOT explicitly turn off stays on.
export function readNurseryFeatures(raw: unknown): NurseryFeatures {
  const out = {} as NurseryFeatures;
  for (const key of NURSERY_FEATURE_KEYS) {
    const value = isFeatureObject(raw) ? raw[key] : undefined;
    out[key] = value !== false;
  }
  return out;
}

export function nurseryFeatureOn(raw: unknown, key: NurseryFeatureKey): boolean {
  return readNurseryFeatures(raw)[key];
}

// Reduce a UI checkbox map (or any unknown payload) down to the known
// keys before saving — the stored JSON only ever holds real toggles.
export function sanitizeNurseryFeatures(raw: unknown): NurseryFeatures {
  return readNurseryFeatures(raw);
}
