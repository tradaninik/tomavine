// Planting advisor engine: month + soil + location -> what to plant now.
// agri.season and care.soil are FREE TEXT — keywords are parsed, and
// missing data never excludes a product (it would empty the advisor).
// Season windows (standard Indian agronomy): Kharif Jun-Oct, Rabi
// Oct-Mar, Zaid Mar-Jun — tune here, one place.

import { CITY_ALIASES, DISTRICTS, STATES, districtByCode, type GeoState } from "@/lib/geo";
import { DELIVERY_STATE_OPTIONS } from "@/lib/states";

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

// -- Location query (S6-D) --------------------------------------
// One search box, three inputs: a 6-digit pincode, a state (name
// or TG/AP/KA code) or a city/town/area name. Parsing is pure -
// geo.ts static data plus the active ServiceLocation rows the
// route passes in - and an unrecognised string simply stays city
// text. Location only ever BOOSTS a candidate; it never excludes.

export type SvcLocLite = { pincode: string; city: string; state: string };

export type LocQuery = {
  raw: string;
  pincode: string | null;
  state: string | null;
  districtCode: string | null;
  cityText: string;
  echo: string | null;
};

const LOC_PIN_RE = /^[1-9]\d{5}$/;

const STATE_LOOKUP: Record<string, string> = {};
for (const s of DELIVERY_STATE_OPTIONS) {
  if (s !== "Other") STATE_LOOKUP[s.toLowerCase()] = s;
}
STATE_LOOKUP["tg"] = "Telangana";
STATE_LOOKUP["ap"] = "Andhra Pradesh";
STATE_LOOKUP["ka"] = "Karnataka";

const stateNameOf = (code: GeoState): string => STATES.find((s) => s.code === code)?.name ?? code;

function svcCityHit(low: string, svcLocs: SvcLocLite[]): SvcLocLite | null {
  return (
    svcLocs.find((l) => l.city.toLowerCase() === low) ??
    svcLocs.find((l) => l.city.toLowerCase().startsWith(low)) ??
    svcLocs.find((l) => l.city.toLowerCase().includes(low)) ??
    null
  );
}

export function parseLocQuery(rawIn: string, svcLocs: SvcLocLite[] = []): LocQuery {
  const raw = rawIn.trim().slice(0, 60);
  const low = raw.toLowerCase();
  if (raw === "") {
    return { raw: "", pincode: null, state: null, districtCode: null, cityText: "", echo: null };
  }

  // 1. pincode - city/state come from the serviceable list, the
  //    district from the city alias table.
  if (LOC_PIN_RE.test(raw)) {
    const hit = svcLocs.find((l) => l.pincode === raw) ?? null;
    const city = hit?.city ?? null;
    const st = hit?.state ?? null;
    const districtCode = city ? (CITY_ALIASES[city.toLowerCase()] ?? null) : null;
    return {
      raw,
      pincode: raw,
      state: st,
      districtCode,
      cityText: city ? city.toLowerCase() : "",
      echo: city && st ? `${raw}: ${city}, ${st}` : `Pincode ${raw}`,
    };
  }

  // 2. state - delivery-list name or short code.
  const state = STATE_LOOKUP[low] ?? null;
  if (state) {
    return { raw, pincode: null, state, districtCode: null, cityText: "", echo: state };
  }

  // 3. district / known town - alias table or a district name in
  //    English, Telugu or Kannada.
  const districtCode =
    CITY_ALIASES[low] ??
    DISTRICTS.find(
      (d) =>
        d.name.toLowerCase() === low ||
        low === `${d.name.toLowerCase()} district` ||
        d.te === raw ||
        d.kn === raw,
    )?.code ??
    null;
  if (districtCode) {
    const d = districtByCode(districtCode);
    if (d) {
      return {
        raw,
        pincode: null,
        state: stateNameOf(d.state),
        districtCode,
        cityText: low,
        echo: `${d.name}, ${stateNameOf(d.state)}`,
      };
    }
  }

  // 4. a city/area the owner listed as serviceable.
  if (low.length >= 2) {
    const svcHit = svcCityHit(low, svcLocs);
    if (svcHit) {
      return {
        raw,
        pincode: null,
        state: svcHit.state,
        districtCode: CITY_ALIASES[low] ?? null,
        cityText: low,
        echo: svcHit.state ? `${svcHit.city}, ${svcHit.state}` : svcHit.city,
      };
    }
  }

  // 5. anything else stays city/area text (matched against
  //    nursery.city and nursery.area in localityOf below).
  return { raw, pincode: null, state: null, districtCode: null, cityText: low, echo: raw };
}

// Per-nursery locality tier - additive, never excludes:
//   3  nursery explicitly serves the queried pincode
//   2  same postal region (pin prefix 3), same city/area text or
//      same district
//   1  same state (geo binding, served pincodes, or delivery
//      scope when a pincode is asked)
//   0  no location signal
export type Locality = { tier: number; label: string | null };

export type NurseryLoc = {
  city: string;
  area?: string | null;
  pincode?: string | null;
  districtCode?: string | null;
  scope?: string | null;
  servicePincodes?: string[];
};

export function localityOf(n: NurseryLoc, loc: LocQuery, pinState?: Map<string, string>): Locality {
  if (loc.raw === "") return { tier: 0, label: null };

  const served = n.servicePincodes ?? [];
  const nCity = (n.city ?? "").trim().toLowerCase();

  // the nursery's district: explicit geo binding first, then the
  // city alias table - nurseries without either still match on
  // city text and served pincodes.
  const nDistrict = n.districtCode ?? CITY_ALIASES[nCity] ?? null;
  const nD = nDistrict ? districtByCode(nDistrict) : null;

  // every state the nursery plausibly belongs to
  const nStates = new Set<string>();
  if (nD) nStates.add(stateNameOf(nD.state));
  for (const p of served) {
    const s = pinState?.get(p);
    if (s) nStates.add(s);
  }

  if (loc.pincode && served.includes(loc.pincode)) {
    return { tier: 3, label: `Delivers to ${loc.pincode}` };
  }
  if (loc.pincode && n.pincode && loc.pincode.slice(0, 3) === n.pincode.slice(0, 3)) {
    return { tier: 2, label: "Same postal area" };
  }
  if (loc.cityText.length > 1 && (nCity === loc.cityText || (n.area ?? "").toLowerCase().includes(loc.cityText))) {
    return { tier: 2, label: "Nursery near you" };
  }
  if (loc.districtCode && nDistrict === loc.districtCode) {
    return { tier: 2, label: "In your district" };
  }

  if (loc.pincode) {
    if (n.scope === "INDIA") return { tier: 1, label: "Ships across India" };
    if (n.scope === "STATE" && n.pincode && loc.pincode.slice(0, 2) === n.pincode.slice(0, 2)) {
      return { tier: 1, label: "Delivers across your state" };
    }
    const locState = loc.state ?? pinState?.get(loc.pincode) ?? null;
    if (locState && nStates.has(locState)) return { tier: 1, label: "In your state" };
    return { tier: 0, label: null };
  }
  if (loc.state && nStates.has(loc.state)) return { tier: 1, label: "In your state" };

  return { tier: 0, label: null };
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
  nursery: {
    name: string;
    slug: string;
    city: string;
    area?: string | null;
    pincode?: string | null;
    districtCode?: string | null;
    scope?: string | null;
    servicePincodes?: string[];
  };
};

export type AdvisorReason = {
  season: SeasonName | "all-year" | null;
  soil: boolean;
  near: boolean;
  locLabel: string | null;
};
export type AdvisorInput = { month: number; soil: SoilChoice; loc: LocQuery; pinState?: Map<string, string> };

export function classify(c: AdvisorCandidate, input: AdvisorInput) {
  const parsed = parseSeason(c.agri);
  const monthSeasons = seasonsForMonth(input.month);
  const seasonHit = parsed.yearRound ? true : parsed.seasons.some((s) => monthSeasons.includes(s));
  const hitSeason = parsed.seasons.find((s) => monthSeasons.includes(s)) ?? null;
  const locality = localityOf(c.nursery, input.loc, input.pinState);
  const soil = soilMatches(c.care, input.soil);

  const reasons: AdvisorReason = {
    season: parsed.declared ? (parsed.yearRound ? "all-year" : hitSeason ?? parsed.seasons[0]) : null,
    soil,
    near: locality.tier >= 2,
    locLabel: locality.label,
  };
  const score = locality.tier + (soil ? 1 : 0) + (parsed.declared && seasonHit ? 1 : 0);
  return { plantNow: seasonHit, reasons, score };
}