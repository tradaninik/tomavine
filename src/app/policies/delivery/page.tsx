"use client";

import { useLang } from "@/lib/i18n";

export default function DeliveryPolicyPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
        {t("s3_policy_delivery")}
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[#1C3A2A]/80">
        {t("s3_policy_delivery_body").split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}