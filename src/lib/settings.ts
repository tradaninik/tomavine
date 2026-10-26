import { db } from "@/lib/db";
import { BULK_TIERS, MAX_QTY, type BulkTier } from "@/lib/bulk-tiers";
import type { PublicSettings } from "@/lib/settings-shared";

// Mission S3: admin-configurable bulk pricing. The SiteSetting row
// (key "bulk") becomes the source of truth once the owner saves
// anything in the seller console; lib/bulk-tiers.ts stays as the
// code default when the row is missing or invalid.

export type SiteSettings = PublicSettings;
export const SETTINGS_KEY = "bulk";

export function defaultSettings(): SiteSettings {
  return {
    tiers: BULK_TIERS.map((t) => ({ minQty: t.minQty, pct: t.pct })),
    maxQty: MAX_QTY,
    preorderEnabled: true,
    whatsappNumber: null,
  };
}

function sanitizeTiers(raw: unknown): BulkTier[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: BulkTier[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const minQty = Number((entry as Record<string, unknown>).minQty);
    const pct = Number((entry as Record<string, unknown>).pct);
    if (!Number.isInteger(minQty) || minQty < 2 || minQty > 10000) return null;
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) return null;
    out.push({ minQty: minQty, pct: pct });
  }
  out.sort((a, b) => a.minQty - b.minQty);
  return out;
}

function sanitizeWhatsapp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D+/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

// Shape-validate any JSON value; invalid or missing fields fall back
// to the code defaults field-by-field. Never throws, never bad math.
export function sanitizeSettings(raw: unknown): SiteSettings {
  const d = defaultSettings();
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    tiers: sanitizeTiers(obj.tiers) ?? d.tiers,
    maxQty:
      Number.isInteger(obj.maxQty) && (obj.maxQty as number) >= 1 && (obj.maxQty as number) <= 1000
        ? (obj.maxQty as number)
        : d.maxQty,
    preorderEnabled: typeof obj.preorderEnabled === "boolean" ? obj.preorderEnabled : d.preorderEnabled,
    whatsappNumber: sanitizeWhatsapp(obj.whatsappNumber),
  };
}

// Per-request read; falls back to code defaults when the row is
// missing/invalid or the database is unreachable.
export async function getSettings(): Promise<SiteSettings> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
    return sanitizeSettings(row?.value);
  } catch {
    return defaultSettings();
  }
}