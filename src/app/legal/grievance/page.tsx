import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grievance & Contact",
  description:
    "How to raise a grievance with Tomavine: Grievance Officer contact, WhatsApp and email channels, acknowledgement within 48 hours, and a 15-day resolution aim.",
};

// Engineering draft — the integrator/owner will arrange legal review.
// English text is authoritative until reviewed counsel signs off.

const H1 = "text-3xl font-semibold tracking-tight text-[#20291D]";
const H2 = "text-lg font-semibold text-[#20291D]";
const P = "text-sm leading-relaxed text-[#66735F]";
const MUTED = "text-xs text-[#8E9A84]";
const LINK = "font-semibold text-[#2F6B3F] underline underline-offset-2";
const ROW = "flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#1C3A2A]/10 bg-white px-4 py-3";

export default function GrievancePage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <div className="rounded-2xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-800">
        ⚠️ Engineering draft — pending legal review. English text is authoritative.
      </div>

      <header className="space-y-2">
        <h1 className={H1} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Grievance &amp; Contact
        </h1>
        <p className={MUTED}>Effective date: 24 October 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Our commitment
        </h2>
        <p className={P}>
          Tomavine operates in the spirit of India&rsquo;s{" "}
          <strong>Consumer Protection (E-Commerce) Rules, 2020</strong>: we publish clear policies, we do not hide who
          the seller of record is, and every complaint gets a real human response. Most issues — a wilted plant, a
          late delivery, a wrong item — are resolved fastest with the nursery itself, through your WhatsApp order
          thread. When that is not enough, or you would rather talk to the platform, come to us.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Grievance Officer
        </h2>
        <div className="rounded-2xl border-2 border-dashed border-amber-400/70 bg-amber-50 px-4 py-4">
          <p className="text-sm font-bold text-amber-800">
            🧑‍⚖️ [NAME / PHONE / EMAIL — TO BE FILLED BY TOMAVINE]
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Nodal Grievance Officer under the Consumer Protection (E-Commerce) Rules, 2020. Contact details are a
            placeholder in this engineering draft and will be published before launch.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          How to reach us
        </h2>
        <div className="space-y-2">
          <div className={ROW}>
            <span className="text-sm font-semibold text-[#20291D]">💬 WhatsApp (order thread — fastest)</span>
            <span className="text-xs text-[#66735F]">Reply to any message about your order</span>
          </div>
          <div className={ROW}>
            <span className="text-sm font-semibold text-[#20291D]">📧 Email (general grievances)</span>
            <span className="text-xs text-[#66735F]">[GRIEVANCE EMAIL — TO BE FILLED BY TOMAVINE]</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          What to include
        </h2>
        <p className={P}>
          Please include your <strong>order code</strong> (it looks like TV-XXXXXX and appears in your order history
          and confirmation message), a short description of the problem, and <strong>photos</strong> where relevant —
          especially for plant condition claims, where condition-on-delivery photos decide{" "}
          <a href="/legal/refund" className={LINK}>
            refund and replacement
          </a>{" "}
          requests. The more specific you are, the faster we can act.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Timelines and escalation
        </h2>
        <p className={P}>
          We acknowledge every grievance within <strong>48 hours</strong> of receiving it, and we aim to resolve
          complaints within <strong>15 days</strong>. If your issue concerns a delivery, replacement or refund, we
          first work with the nursery to fix it; if the nursery cannot or will not, Tomavine decides the matter
          applying our published policies. If you are not satisfied with the outcome, you retain every right under
          the Consumer Protection Act, 2019 — including approaching the consumer commission in your district.
        </p>
      </section>
    </article>
  );
}
