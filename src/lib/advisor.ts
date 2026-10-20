// Planting advisor engine: month + soil + city -> what to plant now.
// agri.season and care.soil are FREE TEXT — keywords are parsed, and
// missing data never excludes a product (it would empty the advisor).
// Season windows (standard Indian agronomy): Kharif Jun-Oct, Rabi
// Oct-Mar, Zaid Mar-Jun — tune here, one place.

export type SoilChoice = "loamy" | "sandy" | "clay" | "black" | "red" | "unsure";
export const SOIL_CHOICES: SoilChoice[] = ["loamy", "sandy", "clay", "black", "red", "unsure"];

const SOIL_KEYWORDS: Record<string, string[]> = {
  loamy: ["loam", "well-drained", "well drained"],
  sandy: ["sand"],
  clay: ["clay"],
  black: ["black"],
  red: ["red"],
};

export type SeasonName = "Kharif" | "Rabi" | "Zaid";

export function seasonsForMonth(month: number): SeasonName[] {
  const s: SeasonName[] = [];
  if (month >= 6 && month <= 10) s.push("Kharif");
  if (month >= 10 || month <= 3) s.push("Rabi");
  if (month >= 3 && month <= 6) s.push("Zaid");
  return s;
}

export type ParsedSeason = { seasons: SeasonName[]; yearRound: boolean; declared: boolean };

export function parseSeason(agri: unknown): ParsedSeason {
  const raw =
    agri !== null && typeof agri === "object" && typeof (agri as Record<string, unknown>).season === "string"
      ? ((agri as Record<string, unknown>).season as string)
      : "";
  if (raw.trim() === "") return { seasons: [], yearRound: true, declared: false };
  const low = raw.toLowerCase();
  if (/(year|all season|any season|perennial)/.test(low)) return { seasons: [], yearRound: true, declared: true };
  const seasons: SeasonName[] = [];
  if (low.includes("kharif")) seasons.push("Kharif");
  if (low.includes("rabi")) seasons.push("Rabi");
  if (low.includes("zaid")) seasons.push("Zaid");
  if (seasons.length === 0) return { seasons: [], yearRound: true, declared: false }; // unrecognized -> don't exclude
  return { seasons, yearRound: false, declared: true };
}

export function soilMatches(care: unknown, soil: SoilChoice): boolean {
  if (soil === "unsure") return false;
  const raw =
    care !== null && typeof care === "object" && typeof (care as Record<string, unknown>).soil === "string"
      ? ((care as Record<string, unknown>).soil as string).toLowerCase()
      : "";
  if (raw === "") return false;
  return (SOIL_KEYWORDS[soil] ?? []).some((k) => raw.includes(k));
}

export type AdvisorCandidate = {
  id: string;
  nameEn: string;
  names: unknown;
  category: string;
  priceMin: number;
  mrp: number;
  stock: number;
  image: string | null;
  care: unknown;
  agri: unknown;
  variants: { id: string; price: number }[];
  rescue: { pct: number; expiresAt: Date } | null;
  nursery: { name: string; slug: string; city: string };
};

export type AdvisorReason = { season: SeasonName | "all-year" | null; soil: boolean; near: boolean };
export type AdvisorInput = { month: number; soil: SoilChoice; city: string };

export function classify(c: AdvisorCandidate, input: AdvisorInput) {
  const parsed = parseSeason(c.agri);
  const monthSeasons = seasonsForMonth(input.month);
  const seasonHit = parsed.yearRound ? true : parsed.seasons.some((s) => monthSeasons.includes(s));
  const hitSeason = parsed.seasons.find((s) => monthSeasons.includes(s)) ?? null;
  const near = input.city.trim().length > 1 && c.nursery.city.toLowerCase() === input.city.trim().toLowerCase();
  const soil = soilMatches(c.care, input.soil);

  const reasons: AdvisorReason = {
    season: parsed.declared ? (parsed.yearRound ? "all-year" : seasonHit ?? parsed.seasons[0]) : null,
    soil,
    near,
  };
  const score = (near ? 2 : 0) + (soil ? 1 : 0) + (parsed.declared && seasonHit ? 1 : 0);
  return { plantNow: seasonHit, reasons, score };
}