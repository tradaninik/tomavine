// ─────────────────────────────────────────────────────────────
// Delivery states (mission S2, scope C).
//
// The 7 states Green Leaf Nurseries delivers to, plus "Other" as
// an escape hatch — nothing is ever BLOCKED by this list, it only
// feeds the checkout dropdown, the BulkLead enquiry form and the
// transport-cost note (shown for any state that is not the
// nursery's home state). Informational messaging only: no state
// is restricted and no automatic fee is ever added.
// ─────────────────────────────────────────────────────────────

export const DELIVERY_STATE_OPTIONS = [
  "Karnataka",
  "Tamil Nadu",
  "Andhra Pradesh",
  "Telangana",
  "Kerala",
  "Maharashtra",
  "Goa",
  "Other",
] as const;

export type DeliveryState = (typeof DELIVERY_STATE_OPTIONS)[number];

// The nursery's home state — checkout picks this as the default
// and suppresses the transport-cost note (no auto fee anywhere,
// the note is the only behaviour difference).
export const HOME_STATE: DeliveryState = "Karnataka";

// Runtime validation helper shared by the checkout + lead forms
// (zod does the server-side check with the same array).
export function isDeliveryState(value: string): value is DeliveryState {
  return (DELIVERY_STATE_OPTIONS as readonly string[]).includes(value);
}
