// ─────────────────────────────────────────────────────────────
// Order trust pack (S8 Wave B) — pure helpers, safe on server
// and client. The DB stores UTC; every comparison here is
// timezone-aware for Asia/Kolkata (IST, UTC+05:30). A DELIVERY
// order with no promised date is NEVER flagged late.
//
// Order.meta shape (flat scalars only — Prisma JSON convention):
//   promisedDate    "YYYY-MM-DD"  IST calendar day, set by seller at Accept
//   promisedAt      ISO string    when the seller set it
//   deliveredAt     ISO string    when the DELIVERED event landed
//   onTime          boolean       computed once at delivery
//   deliveryRating  1–5           gardener's delivery-experience rating
//   deliveryRatedAt ISO string    when the rating was left
// ─────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrustMeta = {
  promisedDate?: string;
  promisedAt?: string;
  deliveredAt?: string;
  onTime?: boolean;
  deliveryRating?: number;
  deliveryRatedAt?: string;
};

export type FlatJson = Record<string, string | number | boolean>;

export function readTrustMeta(meta: unknown): TrustMeta {
  const out: TrustMeta = {};
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return out;
  }
  const m = meta as Record<string, unknown>;
  if (typeof m.promisedDate === "string") out.promisedDate = m.promisedDate;
  if (typeof m.promisedAt === "string") out.promisedAt = m.promisedAt;
  if (typeof m.deliveredAt === "string") out.deliveredAt = m.deliveredAt;
  if (typeof m.onTime === "boolean") out.onTime = m.onTime;
  if (typeof m.deliveryRating === "number") out.deliveryRating = m.deliveryRating;
  if (typeof m.deliveryRatedAt === "string") out.deliveryRatedAt = m.deliveryRatedAt;
  return out;
}

// "YYYY-MM-DD" of the current IST calendar day.
export function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" of the IST day n days from now.
export function plusDaysIST(n: number): string {
  return new Date(Date.now() + IST_OFFSET_MS + n * DAY_MS).toISOString().slice(0, 10);
}

// UTC instant (ms) of 23:59:59.999 IST on the promised day — the
// on-time deadline. Returns null for anything that is not a real
// YYYY-MM-DD calendar date.
export function endOfPromisedDayIST(promisedDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(promisedDate)) {
    return null;
  }
  const t = Date.parse(promisedDate + "T23:59:59.999+05:30");
  if (Number.isNaN(t)) {
    return null;
  }
  return new Date(t).toISOString().slice(0, 10) === promisedDate ? t : null;
}

// Seller-route validation for the promised date. Sentence-case
// errors, matching the seller route convention.
export function validatePromisedDate(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return { ok: false, error: "Promised date must be a valid date" };
  }
  if (endOfPromisedDayIST(input) === null) {
    return { ok: false, error: "Promised date must be a valid date" };
  }
  if (input < todayIST()) {
    return { ok: false, error: "Promised date cannot be in the past" };
  }
  if (input > plusDaysIST(60)) {
    return { ok: false, error: "Promised date is too far ahead" };
  }
  return { ok: true, value: input };
}

// The verdict, computed once at delivery: delivered by END of the
// promised IST day = on time. No promised date → null (never late).
export function computeOnTime(promisedDate: string | undefined, deliveredAtISO: string): boolean | null {
  if (!promisedDate) {
    return null;
  }
  const deadline = endOfPromisedDayIST(promisedDate);
  const delivered = Date.parse(deliveredAtISO);
  if (deadline === null || Number.isNaN(delivered)) {
    return null;
  }
  return delivered <= deadline;
}

// Merge trust keys into whatever Order.meta already holds,
// preserving unknown scalar keys. Flat scalars only — matches the
// Prisma JSON write convention (Record<string, string|number|boolean>
// + as Prisma.InputJsonValue).
export function writeTrustIntoMeta(existing: unknown, patch: FlatJson): FlatJson {
  const base: FlatJson = {};
  if (existing !== null && typeof existing === "object" && !Array.isArray(existing)) {
    for (const [k, v] of Object.entries(existing as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        base[k] = v;
      }
    }
  }
  return { ...base, ...patch };
}

// Map a storefront language code to an Indian locale tag.
export function localeForLang(lang: string): string {
  const l = lang.trim().toLowerCase();
  return /^[a-z]{2}$/.test(l) ? l + "-IN" : "en-IN";
}

// Human display of the promised day, e.g. "Tue, 12 Aug". Anchored
// to noon IST and formatted in Asia/Kolkata so the gardener always
// sees the promised day exactly as the seller saw it.
export function formatPromisedDay(promisedDate: string, locale: string): string {
  const t = Date.parse(promisedDate + "T12:00:00+05:30");
  if (Number.isNaN(t)) {
    return promisedDate;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(t);
  } catch {
    return promisedDate;
  }
}