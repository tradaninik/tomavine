// ─────────────────────────────────────────────────────────────
// Mission 2c — storefront category flip dictionary.
// Plain TS, no imports, inline type. The integrator spreads these
// keys into the single DICT in src/lib/i18n.tsx at merge time
// (6 spread lines, one per language). Agents must not edit
// i18n.tsx directly.
//
// Only keys that could NOT be reused from the base dictionary.
// Reused for 2c: sub_all ("All"), empty_cat ("Nothing here yet"),
// load_error, retry — see /shop/c/[slug]/page.tsx.
// ─────────────────────────────────────────────────────────────

export const DICT_2C: Record<
  "en" | "hi" | "te" | "kn" | "ta" | "mr",
  Record<string, string>
> = {
  en: {
    // Stats band: the count is now the live active-top count from
    // the Category table, so the label must not hard-code "5".
    cat_stats: "shop categories",
  },
  hi: {
    cat_stats: "खरीदारी श्रेणियाँ",
  },
  te: {
    cat_stats: "షాపింగ్ విభాగాలు",
  },
  kn: {
    cat_stats: "ಖರೀದಿ ವರ್ಗಗಳು",
  },
  ta: {
    cat_stats: "வாங்கும் வகைகள்",
  },
  mr: {
    cat_stats: "खरेदी श्रेणी",
  },
};
