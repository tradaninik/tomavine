"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill, inr, paymentLabel, statusLabel, statusTone } from "../ui";
import { todayIST, plusDaysIST, readTrustMeta, formatPromisedDay } from "@/lib/trust";

type Item = {
  id: string;
  nameSnap: string;
  vlabel: string | null;
  qty: number;
  unitPrice: number;
};

type Order = {
  id: string;
  code: string;
  status: string;
  mode: string;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  deliveryOtp: string | null;
  createdAt: string;
  meta: unknown;
  // ── ADDED: tolerant address shape (seed orders use line1,
  // checkout orders use house/street) ──
  address: {
    name?: string;
    phone?: string;
    line1?: string;
    house?: string;
    street?: string;
    city?: string;
    pincode?: string;
  } | null;
  items: Item[];
  payment: { method: string | null; status: string; amount: number } | null;
  user: { name: string | null; phone: string };
};

function tabButton(active: boolean) {
  return active
    ? "rounded-lg bg-[#2F6B3F] px-4 py-1.5 text-sm font-semibold text-white"
    : "rounded-lg px-4 py-1.5 text-sm font-semibold text-[#1C3A2A]/60 hover:bg-[#F7F3E8]";
}

function datePill(active: boolean) {
  return active
    ? "rounded-full bg-[#2F6B3F] px-3 py-1 text-xs font-semibold text-white"
    : "rounded-full border border-[#1C3A2A]/20 px-3 py-1 text-xs font-semibold text-[#1C3A2A]/70 hover:bg-[#F7F3E8]";
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"active" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [datePick, setDatePick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/seller/orders?tab=${tab}`);

      if (!res.ok) throw new Error("failed");

      const data = await res.json();
      setOrders(data.orders);
      setError("");
    } catch {
      setError("Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: string, promisedDate?: string) {
    if (action === "reject") {
      const sure = window.confirm("Reject this order? The buyer will be notified.");

      if (!sure) return;
    }

    setBusyId(id);
    setError("");

    try {
      const payload: Record<string, unknown> = { id: id, action: action };

      if (action === "accept" && typeof promisedDate === "string" && promisedDate.length > 0) {
        payload.promisedDate = promisedDate;
      }

      const res = await fetch("/api/seller/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Action failed");
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && orders.length === 0) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1C3A2A]">Orders</h1>
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          <button className={tabButton(tab === "active")} onClick={() => setTab("active")}>
            Active
          </button>
          <button className={tabButton(tab === "all")} onClick={() => setTab("all")}>
            All
          </button>
        </div>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {orders.length === 0 ? <p className="text-[#1C3A2A]/60">No orders in this view.</p> : null}

      {orders.map((o) => {
        const busy = busyId === o.id;
        const trust = readTrustMeta(o.meta);
        const sel = datePick[o.id] ?? plusDaysIST(1);

        return (
          <Card key={o.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{o.code}</p>
                <p className="text-xs text-[#1C3A2A]/60">
                  {new Date(o.createdAt).toLocaleString("en-IN")} · {o.user.name ?? o.user.phone}
                </p>
              </div>
              <Pill tone={statusTone(o.status)}>{statusLabel(o.status)}</Pill>
            </div>

            {trust.promisedDate && o.status !== "PENDING" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-[#1C3A2A]">🗓 Promised: {formatPromisedDay(trust.promisedDate, "en-IN")}</span>
                {o.status === "DELIVERED" && trust.onTime === true ? <Pill tone="green">Delivered on time</Pill> : null}
                {o.status === "DELIVERED" && trust.onTime === false ? <Pill tone="red">Delivered later than promised</Pill> : null}
              </div>
            ) : null}

            <ul className="mt-4 divide-y divide-[#1C3A2A]/5 text-sm">
              {o.items.map((it) => (
                <li key={it.id} className="flex justify-between py-2">
                  <span className="text-[#1C3A2A]">
                    {it.qty} × {it.nameSnap}
                    {it.vlabel ? <span className="text-[#1C3A2A]/50"> ({it.vlabel})</span> : null}
                  </span>
                  <span className="text-[#1C3A2A]">{inr(it.qty * it.unitPrice)}</span>
                </li>
              ))}
            </ul>

            {/* ── ADDED: delivery address (line1 for seed orders,
                house/street for checkout orders) ── */}
            {o.address ? (
              <div className="mt-3 rounded-xl bg-[#F7F3E8] px-4 py-3 text-sm text-[#1C3A2A]/80">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/50">Delivery address</p>
                <p className="mt-1 font-semibold text-[#1C3A2A]">
                  {o.address.line1 ?? [o.address.house, o.address.street].filter(Boolean).join(", ")}
                  {o.address.city ? `, ${o.address.city}` : ""}
                  {o.address.pincode ? ` — ${o.address.pincode}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-[#1C3A2A]/60">
                  {o.address.name ?? ""}
                  {o.address.phone ? ` · ${o.address.phone}` : ""}
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap justify-end gap-4 text-xs text-[#1C3A2A]/60">
              <span>Subtotal {inr(o.subtotal)}</span>
              <span>Delivery {inr(o.deliveryFee)}</span>
              <span>GST {inr(o.tax)}</span>
              <span className="font-bold text-[#1C3A2A]">Total {inr(o.total)}</span>
              <span>
                {o.payment ? paymentLabel(o.payment.method, o.payment.status) : "no payment record"}
              </span>
            </div>

            {o.status === "OUT_FOR_DELIVERY" && o.deliveryOtp ? (
              <div className="mt-4 rounded-xl bg-[#1C3A2A] px-4 py-3 text-center text-[#F7F3E8]">
                <p className="text-xs uppercase tracking-wide text-[#F7F3E8]/60">Delivery PIN — collect from buyer</p>
                <p className="text-3xl font-bold tracking-[0.4em]">{o.deliveryOtp}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {o.status === "PENDING" ? (
                <>
                  {o.mode === "DELIVERY" ? (
                    <div className="w-full rounded-xl bg-[#F7F3E8] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/50">Promised delivery date — shown to the buyer</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" className={datePill(sel === todayIST())} onClick={() => setDatePick({ ...datePick, [o.id]: todayIST() })}>
                          Today
                        </button>
                        <button type="button" className={datePill(sel === plusDaysIST(1))} onClick={() => setDatePick({ ...datePick, [o.id]: plusDaysIST(1) })}>
                          Tomorrow
                        </button>
                        <button type="button" className={datePill(sel === plusDaysIST(2))} onClick={() => setDatePick({ ...datePick, [o.id]: plusDaysIST(2) })}>
                          In 2 days
                        </button>
                        <input
                          type="date"
                          className="rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1 text-xs text-[#1C3A2A]"
                          value={sel}
                          onChange={(e) => setDatePick({ ...datePick, [o.id]: e.target.value })}
                        />
                        <button type="button" className={datePill(sel === "")} onClick={() => setDatePick({ ...datePick, [o.id]: "" })}>
                          No date
                        </button>
                        {sel ? <span className="text-xs font-semibold text-[#24562F]">→ promised {formatPromisedDay(sel, "en-IN")}</span> : null}
                      </div>
                    </div>
                  ) : null}
                  <Btn onClick={() => act(o.id, "accept", o.mode === "DELIVERY" ? sel || undefined : undefined)} disabled={busy}>
                    {o.mode === "DELIVERY" && sel ? `Accept — promise ${formatPromisedDay(sel, "en-IN")}` : "Accept"}
                  </Btn>
                  <Btn kind="danger" onClick={() => act(o.id, "reject")} disabled={busy}>
                    Reject
                  </Btn>
                </>
              ) : null}

              {o.status === "CONFIRMED" || o.status === "PREPARING" ? (
                <Btn onClick={() => act(o.id, "out")} disabled={busy}>
                  Mark out for delivery
                </Btn>
              ) : null}

              {o.status === "OUT_FOR_DELIVERY" ? (
                <Btn onClick={() => act(o.id, "delivered")} disabled={busy}>
                  Mark delivered
                </Btn>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}