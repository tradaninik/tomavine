"use client";

import { useEffect, useState } from "react";
import { Card, Empty, ErrBox, Loading, Pill, formatDateTime, inr, inputCls, statusLabel, statusTone } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

const STATUSES = ["ALL", "PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REJECTED"];

type OrderRow = {
  id: string;
  code: string;
  status: string;
  mode: string;
  total: number;
  createdAt: string;
  buyer: string;
  buyerPhone: string;
  nurseryName: string;
  nurseryCity: string;
  itemCount: number;
  paymentMethod: string | null;
};

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch("/api/admin/orders")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data && Array.isArray(data.orders)) {
          setRows(data.orders);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const filtered = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrBox>
        <p className="mb-2">Could not load orders — please retry.</p>
        <button type="button" onClick={() => setReload((x) => x + 1)} className="text-sm font-bold underline">
          Retry
        </button>
      </ErrBox>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={SERIF}>
          Orders
        </h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} w-52`}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? `All (${rows.length})` : `${statusLabel(s)} (${rows.filter((r) => r.status === s).length})`}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-[#8E9A84]">Read-only oversight — sellers manage order status from their dashboard.</p>

      {filtered.length === 0 ? (
        <Empty emoji="📦" title="No orders in this view" />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-[#20291D]" style={SERIF}>
                    {o.code}
                  </p>
                  <p className="text-xs text-[#8E9A84]">
                    {formatDateTime(o.createdAt)} · {o.buyer} ({o.buyerPhone}) · {o.nurseryName}, {o.nurseryCity}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(o.status)}`}>
                  {statusLabel(o.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="cream">{o.mode === "PICKUP" ? "🏪 Pickup" : "🚚 Delivery"}</Pill>
                  <Pill tone={o.paymentMethod === "cod" ? "leaf" : "sky"}>
                    {o.paymentMethod === "cod" ? "💵 COD" : "Online"}
                  </Pill>
                  <span className="text-xs text-[#66735F]">{o.itemCount} items</span>
                </div>
                <p className="text-lg font-bold text-[#1C3A2A]">{inr(o.total)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}