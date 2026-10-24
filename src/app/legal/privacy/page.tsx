import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data Tomavine collects (phone, name, address, order history, WhatsApp communication), why we collect it, and your rights.",
};

// Engineering draft — the integrator/owner will arrange legal review.
// English text is authoritative until reviewed counsel signs off.
// Provider names below must match the real stack: Razorpay (payments),
// WhatsApp/Meta (OTP + order messages), Upstash (rate limit + OTP store),
// Vercel Blob (listing images).

const H1 = "text-3xl font-semibold tracking-tight text-[#20291D]";
const H2 = "text-lg font-semibold text-[#20291D]";
const P = "text-sm leading-relaxed text-[#66735F]";
const MUTED = "text-xs text-[#8E9A84]";
const LINK = "font-semibold text-[#2F6B3F] underline underline-offset-2";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <div className="rounded-2xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-800">
        ⚠️ Engineering draft — pending legal review. English text is authoritative.
      </div>

      <header className="space-y-2">
        <h1 className={H1} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Privacy Policy
        </h1>
        <p className={MUTED}>Effective date: 24 October 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          1. Data we collect
        </h2>
        <p className={P}>
          Tomavine is a phone-first marketplace, so we keep what we collect deliberately small: your{" "}
          <strong>mobile phone number</strong>, the <strong>name</strong> you give with an order, your{" "}
          <strong>delivery address</strong> (house, street, city, pincode), your <strong>order history</strong>, and
          the <strong>WhatsApp communication</strong> that surrounds your orders — OTPs, order confirmations and
          delivery updates. We also keep routine technical logs needed to run the service securely.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          2. Why we collect it
        </h2>
        <p className={P}>
          Everything above is used to <strong>fulfil your orders</strong> and to{" "}
          <strong>authenticate you when you log in</strong> with a one-time password. Messages we send over WhatsApp
          are <strong>service messages</strong> — OTPs, confirmations, dispatch and delivery updates, and replies
          about a specific order. We do not send marketing spam, and we do not sell your data to anyone.
        </p>
        <p className={P}>
          The nurseries you order from receive the details they need to pack and deliver your order: your name,
          address, phone number and the items ordered. They may use these details only to serve your order.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          3. Service providers we rely on
        </h2>
        <p className={P}>
          We use a small number of processors, each only for its job: <strong>Razorpay</strong> processes online
          payments (UPI, cards, netbanking); <strong>WhatsApp (Meta)</strong> carries our OTPs and order messages;{" "}
          <strong>Upstash</strong> provides rate limiting and short-lived OTP storage for security; and{" "}
          <strong>Vercel Blob</strong> hosts product and listing images. These providers process data on our
          instructions to run the marketplace; they do not use your order data for their own purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          4. Cookies and tracking
        </h2>
        <p className={P}>
          Tomavine sets exactly one cookie: a <strong>JWT session cookie</strong> that keeps you logged in for seven
          days. We use <strong>no advertising trackers and no third-party analytics cookies</strong>. Your language
          and location preferences are stored locally on your own device.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          5. How long we keep data
        </h2>
        <p className={P}>
          We keep your data for as long as your account is active, and afterwards only for as long as the law
          requires — for example, tax and transaction records for statutory periods, or records needed to resolve a
          dispute. Order history that is no longer legally required is deleted when your account is.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          6. Your rights
        </h2>
        <p className={P}>
          You may ask us what data we hold about you, ask for corrections, or request deletion of your account and
          personal data through our{" "}
          <a href="/legal/grievance" className={LINK}>
            grievance channel
          </a>
          . These rights include the access, correction and erasure rights given to you by India&rsquo;s{" "}
          <strong>Digital Personal Data Protection Act, 2023</strong>. We will act on verified requests within a
          reasonable period, except where the law requires us to retain certain records (for example, tax documents).
          Deleting your account removes your phone number, name and addresses from active use.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={H2} style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          7. Grievance contact
        </h2>
        <p className={P}>
          Questions or complaints about privacy go to our Grievance Officer:{" "}
          <strong>[NAME / PHONE / EMAIL — TO BE FILLED BY TOMAVINE]</strong>. See the{" "}
          <a href="/legal/grievance" className={LINK}>
            Grievance &amp; Contact
          </a>{" "}
          page for acknowledgement and resolution timelines.
        </p>
      </section>
    </article>
  );
}
