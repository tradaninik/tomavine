"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill, inr, statusTone } from "../ui";

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
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  deliveryOtp: string | null;
  createdAt: string;
  items: Item[];
  payment: { method: string | null; status: string; amount: number } | null;
  user: { name: string | null; phone: string };
};

function tabButton(active: boolean) {
  return active
    ? "rounded-lg bg-[#2F6B3F] px-4 py-1.5 text-sm font-semibold text-white"
    : "rounded-lg px-4 py-1.5 text-sm font-semibold text-[#1C3A2A]/60 hover:bg-[#F7F3E8]";
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"active" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  async function act(id: string, action: string) {
    if (action === "reject") {
      const sure = window.confirm("Reject this order? The buyer will be notified.");

      if (!sure) return;
    }

    setBusyId(id);
    setError("");

    try {
      const res = await fetch("/api/seller/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, action: action }),
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

        return (
          <Card key={o.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{o.code}</p>
                <p className="text-xs text-[#1C3A2A]/60">
                  {new Date(o.createdAt).toLocaleString("en-IN")} · {o.user.name ?? o.user.phone}
                </p>
              </div>
              <Pill tone={statusTone(o.status)}>{o.status.replaceAll("_", " ")}</Pill>
            </div>

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

            <div className="mt-3 flex flex-wrap justify-end gap-4 text-xs text-[#1C3A2A]/60">
              <span>Subtotal {inr(o.subtotal)}</span>
              <span>Delivery {inr(o.deliveryFee)}</span>
              <span>GST {inr(o.tax)}</span>
              <span className="font-bold text-[#1C3A2A]">Total {inr(o.total)}</span>
              <span>
                {o.payment ? `${o.payment.method ?? "online"} · ${o.payment.status}` : "no payment record"}
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
                  <Btn onClick={() => act(o.id, "accept")} disabled={busy}>
                    Accept
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