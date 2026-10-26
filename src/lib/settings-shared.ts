import type { BulkTier } from "@/lib/bulk-tiers";

// Mission S3: shape served by GET /api/settings/public. Client-safe
// (no database import) so storefront components can use it freely.
export type PublicSettings = {
  tiers: BulkTier[];
  maxQty: number;
  preorderEnabled: boolean;
  whatsappNumber: string | null;
};

// Build a wa.me deep link with URL-encoded prefilled text.
export function whatsappLink(number: string, text: string): string {
  return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
}