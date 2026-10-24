import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Serviceable areas per nursery, dispatch within 1–3 days of confirmation, typical delivery in 2–7 days — weather and location dependent.",
};

// Engineering draft — the integrator/owner will arrange legal review.
// English text is authoritative until reviewed counsel signs off.

const H1 = "text-3xl font-semibold tracking-tight text-[#20291D]";
const H2 = "text-lg font-semibold text-[#20291D]";
const P = "text-sm leading-relaxed text-[#66735F]";
const MUTED = "text-xs text-[#8E9A84]";
const LINK = "font-semibold text-[#2F6B3F] underline underline-offset-2";

export default function ShippingPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <div className="rounded-2xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-800">
        ⚠️ Engineering draft — pending legal review. English text is authoritative.
      </div>

      <header className="space-y-2">
        <h1 className={H1} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Shipping Policy
        </h1>
        <p className={MUTED}>Effective date: 24 October 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          1. Where we deliver
        </h2>
        <p className={P}>
          Each nursery on Tomavine sets its own <strong>delivery area</strong> — its home city, a radius around the
          nursery, or across India for nurseries that ship nationwide. Product pages and nursery pages show the
          applicable delivery area, and the storefront shows an estimated delivery band for your location. If your
          address falls outside every nursery&rsquo;s serviceable area, the checkout will let you know before you
          order.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          2. Dispatch timelines
        </h2>
        <p className={P}>
          Nurseries pack live plants with care, which takes time. Orders are typically{" "}
          <strong>dispatched within 1–3 days after the nursery confirms your order</strong>. Some nurseries confirm
          over WhatsApp before packing, so a quick reply from you speeds things up. You will receive a message when
          your order is confirmed and again when it is dispatched.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          3. Delivery estimates — weather and location dependent
        </h2>
        <p className={P}>
          Typical delivery takes <strong>2–7 days from dispatch</strong>, depending on how far you are from the
          nursery. Please remember:{" "}
          <strong>
            all delivery times are estimates, not guarantees — they depend on the weather and your location.
          </strong>{" "}
          Extreme heat, heavy rain, floods or strikes can delay a shipment because nurseries hold plants back rather
          than ship them into conditions that would kill them. When that happens, the nursery will tell you the new
          expected date.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          4. On delivery — OTP and cash-ready
        </h2>
        <p className={P}>
          Some deliveries are handed over against a <strong>delivery OTP</strong> sent to your phone — keep your phone
          with you on delivery day. For <strong>Cash on Delivery</strong> orders, please keep the exact amount ready
          for the delivery partner; they typically cannot make change. Live plants should be inspected at the door —
          see our{" "}
          <a href="/legal/refund" className={LINK}>
            Refund, Return &amp; Replacement Policy
          </a>{" "}
          for the 48-hour replacement window.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          5. If we cannot deliver to you
        </h2>
        <p className={P}>
          If an address turns out to be non-serviceable after an order is placed — remote location, courier refusal or
          an address outside the nursery&rsquo;s area — the order will be{" "}
          <strong>cancelled and refunded automatically</strong>. Online payments return to the original payment method
          within 5–7 business days; COD orders need no refund because no payment was collected.
        </p>
      </section>
    </article>
  );
}
