import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund, Return & Replacement Policy",
  description:
    "Live plants are perishable: how to inspect on delivery, the 48-hour replacement window with photos, refunds for online and COD payments, and exclusions.",
};

// Engineering draft — the integrator/owner will arrange legal review.
// English text is authoritative until reviewed counsel signs off.

const H1 = "text-3xl font-semibold tracking-tight text-[#20291D]";
const H2 = "text-lg font-semibold text-[#20291D]";
const P = "text-sm leading-relaxed text-[#66735F]";
const MUTED = "text-xs text-[#8E9A84]";
const LINK = "font-semibold text-[#2F6B3F] underline underline-offset-2";

export default function RefundPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <div className="rounded-2xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-800">
        ⚠️ Engineering draft — pending legal review. English text is authoritative.
      </div>

      <header className="space-y-2">
        <h1 className={H1} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Refund, Return &amp; Replacement Policy
        </h1>
        <p className={MUTED}>Effective date: 24 October 2026</p>
      </header>

      <div className="rounded-2xl border border-[#2F6B3F]/30 bg-[#EDF2E6]/70 px-4 py-3 text-sm font-semibold text-[#24562F]">
        🪴 LIVE PLANTS ARE PERISHABLE — please inspect your plants at the door at the time of delivery.
      </div>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          1. Inspect on delivery
        </h2>
        <p className={P}>
          Plants are living, perishable things, and the moment of delivery is the only fair moment to judge their
          condition. When your order arrives, open the package and check each plant with the delivery partner present
          — ideally photograph the plants and packaging as received. This protects you and helps the nursery improve
          packing.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          2. The 48-hour replacement window
        </h2>
        <p className={P}>
          If a plant arrives damaged, badly wilted or dead, you may request a{" "}
          <strong>replacement or refund within 48 hours of delivery</strong>. Your request must include{" "}
          <strong>condition-on-delivery photos</strong> — clear pictures of the plant as it arrived, ideally still
          unopened or unwilted evidence of the delivery state. Claims made after 48 hours, or without photos showing
          the delivery condition, may be declined because a plant&rsquo;s post-delivery condition also depends on the
          care it receives after arrival.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          3. Damage in transit and wrong items
        </h2>
        <p className={P}>
          If a plant is <strong>damaged in transit</strong> — broken stems, crushed pots, dried-out roots or spillage
          — you are entitled to a replacement or a refund, at your choice. If the nursery sends the{" "}
          <strong>wrong item</strong> or a different size than ordered, the same applies. In both cases tell us within
          the 48-hour window with photos of the item and packaging; the nursery will then arrange a replacement
          dispatch or a refund.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          4. Non-perishable items — pots, tools and inputs
        </h2>
        <p className={P}>
          Pots, tools, fertilisers and other garden inputs are not perishable. If such an item has a manufacturing
          defect or arrives damaged, you may request a replacement or refund within{" "}
          <strong>7 days of delivery</strong>, with photos of the defect. Please keep the item and its packaging until
          the claim is resolved.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          5. How refunds are paid
        </h2>
        <p className={P}>
          <strong>Online payments</strong> (UPI, cards, netbanking) are refunded to the original payment method and
          typically reach you within <strong>5–7 business days</strong> of approval, depending on your bank.{" "}
          <strong>Cash on Delivery</strong> orders are refunded via UPI or bank transfer to an account or UPI ID you
          provide — we will confirm the details with you over the order thread.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          6. What is not covered
        </h2>
        <p className={P}>
          Plants are living things, and outcomes after delivery depend on the care they receive. We cannot replace or
          refund plants for <strong>improper care after delivery</strong> (overwatering, wrong light, repotting shock,
          pests from other plants) or for <strong>weather exposure after delivery</strong> — frost, heat waves or
          waterlogging the plant met after it was accepted. Requests outside the 48-hour window, or without delivery
          photos, also fall outside this policy. Rescue deals — discounted clearance stock — are sold as described in
          each listing; cosmetic imperfections described in the listing are not a ground for replacement, though
          transit damage remains covered.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          7. How to make a request
        </h2>
        <p className={P}>
          The fastest route is your <strong>WhatsApp order thread</strong> — reply to the delivery message for your
          order with photos and a short description of what is wrong. You can also use the{" "}
          <a href="/legal/grievance" className={LINK}>
            grievance channel
          </a>
          . Please include your <strong>order code</strong> and clear photos of the plant and packaging as they
          arrived. The nursery handles replacements and refunds; if you are not satisfied with the outcome, escalate
          to the Grievance Officer.
        </p>
      </section>
    </article>
  );
}
