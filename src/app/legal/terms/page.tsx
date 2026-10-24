import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms of use for the Tomavine marketplace: nurseries are sellers of record, accounts via phone OTP, pricing, payments, and governing law (India).",
};

// Engineering draft — the integrator/owner will arrange legal review.
// English text is authoritative until reviewed counsel signs off.

const H1 = "text-3xl font-semibold tracking-tight text-[#20291D]";
const H2 = "text-lg font-semibold text-[#20291D]";
const P = "text-sm leading-relaxed text-[#66735F]";
const MUTED = "text-xs text-[#8E9A84]";
const LINK = "font-semibold text-[#2F6B3F] underline underline-offset-2";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <div className="rounded-2xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-800">
        ⚠️ Engineering draft — pending legal review. English text is authoritative.
      </div>

      <header className="space-y-2">
        <h1 className={H1} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Terms of Use
        </h1>
        <p className={MUTED}>Effective date: 24 October 2026 · Applies to tomavine and the Tomavine storefront</p>
      </header>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          1. Tomavine is a marketplace
        </h2>
        <p className={P}>
          Tomavine operates an online marketplace that connects plant nurseries with customers. Listings, prices and
          product descriptions are created and controlled by the nurseries. Each nursery is the{" "}
          <strong>seller of record</strong> for the items it lists: the contract of sale for every order is formed
          between you and that nursery. Tomavine facilitates the marketplace — catalogue technology, order flow,
          payment collection on the nursery&rsquo;s behalf, and delivery coordination — but does not itself grow, own
          or sell the plants unless expressly stated.
        </p>
        <p className={P}>
          Because sellers are independent, product availability, plant size and condition can vary between nurseries.
          Where a listing says so, delivery areas and dispatch practices are also set by the nursery.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          2. Your account and phone OTP
        </h2>
        <p className={P}>
          You access your Tomavine account with a mobile phone number. When you log in, we send a one-time password
          (OTP) to that number over WhatsApp (or SMS where WhatsApp is unavailable). You are responsible for keeping
          your number secure and for activity carried out under your number. You must be at least 18 years old, or use
          the service under the supervision of a parent or guardian.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          3. Pricing, taxes and GST
        </h2>
        <p className={P}>
          Prices shown on the storefront are set by the selling nursery and include applicable Goods and Services Tax
          (GST) unless a line item says otherwise. The amount you confirm at checkout — items, GST, and any delivery
          or Cash-on-Delivery fee — is the amount you owe. If a listing or price is obviously incorrect, the nursery
          may decline the order and you will not be charged.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          4. Orders and acceptance
        </h2>
        <p className={P}>
          Placing an order is an offer to buy, not a completed sale. Every order is subject to{" "}
          <strong>confirmation by the selling nursery</strong>. The nursery may accept or decline an order, typically
          over WhatsApp. Nurseries may decline orders to addresses that are remote or outside their serviceable
          delivery area, or where stock or weather makes fulfilment unsafe for the plants. If your order is declined
          or cancelled for these reasons, any payment made is refunded automatically in full.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          5. Payment
        </h2>
        <p className={P}>
          You may pay online (UPI, cards and netbanking, processed by Razorpay) or by Cash on Delivery. Online
          payments are collected on the nursery&rsquo;s behalf. For Cash on Delivery, please keep the exact amount
          ready for the delivery partner. Refunds follow our{" "}
          <a href="/legal/refund" className={LINK}>
            Refund, Return &amp; Replacement Policy
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          6. Acceptable use
        </h2>
        <p className={P}>
          Do not misuse the marketplace: do not place fraudulent or speculative orders, abuse the OTP or review
          systems, scrape or reverse-engineer the platform, infringe others&rsquo; rights, or interfere with other
          users or nurseries. Reviews must reflect genuine purchase experiences. We may suspend accounts that abuse
          the platform, and nurseries may decline orders from accounts that abuse theirs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          7. Intellectual property
        </h2>
        <p className={P}>
          The Tomavine name, logo and platform design belong to Tomavine. Nursery names, listing text and product
          photographs belong to the nursery that uploaded them (or to its licensors). You may use the storefront only
          to shop; you may not copy or reuse listings, photographs or platform content without permission.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          8. Live plants and limitation of liability
        </h2>
        <p className={P}>
          Live plants are perishable and living things. Their survival and growth after delivery depend on your
          climate, soil and care, and Tomavine cannot guarantee growth outcomes. To the maximum extent permitted by
          law, neither Tomavine nor the selling nursery is liable for indirect or consequential losses. Liability for
          any order is limited to the amount you paid for that order. Nothing in these terms limits liability that
          cannot be limited under Indian law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          9. Governing law and jurisdiction
        </h2>
        <p className={P}>
          These terms are governed by the laws of India. Subject to mandatory consumer protections, the courts at{" "}
          <strong>[JURISDICTION CITY — TO BE CONFIRMED BY TOMAVINE LEGAL]</strong> shall have exclusive jurisdiction
          over disputes arising from these terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          10. Changes to these terms
        </h2>
        <p className={P}>
          We may update these terms as the marketplace evolves. The current version is always available at this page
          with its effective date; material changes will be surfaced in the app before they take effect. Continuing
          to use Tomavine after a change means you accept the updated terms.
        </p>
        <p className={MUTED}>
          Questions about these terms? Write to the Grievance Officer via the{" "}
          <a href="/legal/grievance" className={LINK}>
            Grievance &amp; Contact
          </a>{" "}
          page.
        </p>
      </section>
    </article>
  );
}
