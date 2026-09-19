"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Empty, ErrBox, Loading, SectionTitle, formatDate, inr, statusTone } from "../ui";
import { useLang } from "@/lib/i18n";

const STATUS_KEYS: Record<string, string> = {
  PENDING: "st_pending",
  CONFIRMED: "st_confirmed",
  PREPARING: "st_preparing",
  OUT_FOR_DELIVERY: "st_out",
  DELIVERED: "st_delivered",
  CANCELLED: "st_cancelled",
  REJECTED: "st_rejected",
};

function StatusChip({ status }: { status: string }) {
  const { t } = useLang();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(status)}`}>
      {t(STATUS_KEYS[status] ?? status)}
    </span>
  );
}

type OrderRow = {
  id: string;
  code: string;
  status: string;
  mode: string;
  total: number;
  createdAt: string;
  itemCount: number;
  reviewed: boolean;
  nursery: { name: string; slug: string; city: string };
};

export default function OrdersPage() {
  const { t } = useLang();
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    setError(false);
    fetch("/api/customer/orders")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        setRows(Array.isArray(data.orders) ? data.orders : []);
      })
      .catch(() => {
        setError(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SectionTitle>{t("my_orders")}</SectionTitle>

      {error ? (
        <div className="space-y-4">
          <ErrBox>{t("load_error")}</ErrBox>
          <Btn onClick={load}>{t("retry")}</Btn>
        </div>
      ) : rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty
          emoji="🧺"
          title={t("orders_empty")}
          text={t("orders_empty_s")}
          action={<Btn href="/shop/category/plants">{t("browse")}</Btn>}
        />
      ) : (
        <div className="space-y-4">
          {rows.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-[#1C3A2A]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
                    {o.code}
                  </p>
                  <p className="text-xs text-[#66735F]">{t("placed_on", { d: formatDate(o.createdAt) })}</p>
                </div>
                <StatusChip status={o.status} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#66735F]">
                <Link href={`/shop/nursery/${o.nursery.slug}`} className="font-semibold text-[#2F6B3F] hover:underline">
                  {o.nursery.name} · {o.nursery.city}
                </Link>
                <span className="rounded-full bg-[#EDF2E6] px-2.5 py-0.5 text-xs font-semibold text-[#24562F]">
                  {o.mode === "PICKUP" ? t("pickup_mode") : t("delivery_mode")}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E0CE] pt-3">
                <span className="text-sm text-[#66735F]">
                  {t("order_items", { n: o.itemCount })} · <span className="font-bold text-[#1C3A2A]">{inr(o.total)}</span>
                </span>
                <span className="flex items-center gap-3">
                  {o.reviewed ? (
                    <span className="text-xs font-semibold text-[#24562F]">✓ {t("reviewed")}</span>
                  ) : null}
                  <Btn href={`/shop/orders/${o.id}`} size="sm">
                    {t("view_details")} →
                  </Btn>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}