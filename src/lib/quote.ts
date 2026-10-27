import { randomBytes } from "node:crypto";

// Mission S4: quotation helpers shared by the seller console APIs
// and the public /quote/<token> page. Server-side only (node:crypto).

export type QuoteItem = {
  name: string;
  qty: number;
  unit: number;
  note?: string | null;
};

// Lead pipeline (seller console). "quoted" is set automatically when
// a quotation is sent; "won" when the buyer accepts on the public
// quote page.
export const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Quote lifecycle. "expired" is computed at read time from
// validUntil, never stored - a lapsed quote is simply displayed as
// expired until the nursery sends a fresh quotation.
export const QUOTE_STATUSES = ["sent", "viewed", "accepted", "declined"] as const;

export const VALID_DAYS_DEFAULT = 7;
export const VALID_DAYS_MIN = 1;
export const VALID_DAYS_MAX = 30;

// 32 hex chars - unguessable in a URL, safe to hand to WhatsApp.
export function newQuoteToken(): string {
  return randomBytes(16).toString("hex");
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

// Validate and normalize builder input. Returns null when the payload
// is not a usable item list (the caller answers 400).
export function sanitizeItems(raw: unknown): QuoteItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) {
    return null;
  }

  const out: QuoteItem[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }

    const row = entry as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const qty = Number(row.qty);
    const unit = Number(row.unit);

    if (name.length < 1 || name.length > 200) {
      return null;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) {
      return null;
    }
    if (!Number.isInteger(unit) || unit < 0 || unit > 100000000) {
      return null;
    }

    const note =
      typeof row.note === "string" && row.note.trim().length > 0
        ? row.note.trim().slice(0, 500)
        : null;

    out.push({ name: name, qty: qty, unit: unit, note: note });
  }

  return out;
}

export function itemsTotal(items: QuoteItem[]): number {
  let sum = 0;
  for (const item of items) {
    sum += item.qty * item.unit;
  }
  return sum;
}

export function sanitizeTransport(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100000000) {
    return 0;
  }
  return n;
}

export function sanitizeValidDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < VALID_DAYS_MIN || n > VALID_DAYS_MAX) {
    return VALID_DAYS_DEFAULT;
  }
  return n;
}

// A quote is expired once its validity lapsed and the buyer has not
// accepted or declined yet.
export function quoteIsExpired(quote: { validUntil: Date | null; status: string }): boolean {
  if (quote.validUntil === null) {
    return false;
  }
  if (quote.status === "accepted" || quote.status === "declined") {
    return false;
  }
  return quote.validUntil.getTime() < Date.now();
}

// Headline number: builder quotes carry total; legacy rows keep
// amount with total 0.
export function quoteTotalOf(quote: { amount: number; total: number }): number {
  return quote.total > 0 ? quote.total : quote.amount;
}

// Short reference for WhatsApp text (first 8 hex chars, uppercase).
export function quoteRef(token: string | null): string {
  return token === null ? "" : token.slice(0, 8).toUpperCase();
}