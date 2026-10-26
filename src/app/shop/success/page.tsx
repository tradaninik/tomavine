"use client";

import { useEffect, useState } from "react";
import { Btn, Card, Loading, inr } from "../ui";
import { useLang } from "@/lib/i18n";
import { HOME_STATE } from "@/lib/states";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };
const STORE_KEY = "tv_orders_last";

type StoredOrder = { code: string; amount: number };
// Mission S2: the checkout passes the chosen delivery state along so
// the transport-cost note can follow the order confirmation.
type Stored = { orders: StoredOrder[]; duplicate: boolean; state?: string };

export default function SuccessPage() {
  const { t } = useLang();
  const [data, setData] = useState<Stored | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORE_KEY);
      window.sessionStorage.removeItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        if (parsed && Array.isArray(parsed.orders)) {
          setData({
            orders: parsed.orders,
            duplicate: parsed.duplicate === true,
            state: typeof parsed.state === "string" ? parsed.state : undefined,
          });
        }
      }
    } catch {
      // malformed payload — fall through to the generic view
    }
    setReady(true);
  }, []);

  if (!ready) {
    return <Loading />;
  }

  const grandTotal = data ? data.orders.reduce((sum, o) => sum + (o.amount ?? 0), 0) : 0;

  return (
    <div className="mx-auto max-w-xl">
      <Card className="text-center">
        <p className="text-6xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#20291D]" style={SERIF}>
          {t("order_placed")}
        </h1>
        {data && data.duplicate ? (
          <p className="mt-2 text-sm text-[#66735F]">{t("duplicate_note")}</p>
        ) : (
          <p className="mt-2 text-sm text-[#66735F]">{t("success_s")}</p>
        )}

        {data && data.orders.length > 0 ? (
          <div className="mt-6 space-y-2 text-left">
            {data.orders.map((o) => (
              <div key={o.code} className="flex items-center justify-between gap-3 rounded-2xl bg-[#EDF2E6] px-4 py-3">
                <span className="font-bold text-[#20291D]" style={SERIF}>
                  {o.code}
                </span>
                <span className="text-sm font-semibold text-[#1C3A2A]">
                  {t("amount_due")}: {inr(o.amount)}
                </span>
              </div>
            ))}
            <p className="pt-1 text-right text-sm font-bold text-[#1C3A2A]">
              {t("total")}: {inr(grandTotal)}
            </p>
          </div>
        ) : null}

        {data && typeof data.state === "string" && data.state !== HOME_STATE ? (
          // Mission S2 (scope C): transport note on the confirmation for
          // deliveries outside the nursery's home state — informational
          // only, the nursery confirms the cost before dispatch.
          <div className="mt-4 rounded-2xl border border-[#E39B2D]/40 bg-[#F7F3E8] p-3 text-sm font-semibold text-[#8a5a12]">
            🚛 {t("transport_note")}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Btn href="/shop/c/plants">{t("continue_shopping")}</Btn>
          <Btn href="/shop/orders" variant="outline">
            {t("my_orders")}
          </Btn>
        </div>
      </Card>
    </div>
  );
}