"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Pill, Stat, inr, statusTone } from "./ui";

type Overview = {
  todayRevenue: number;
  monthRevenue: number;
  pendingOrders: number;
  activeSubscriptions: number;
  lowStock: { id: string; nameEn: string; stock: number; category: string }[];
  recentOrders: {
    id: string;
    code: string;
    status: string;
    total: number;
    createdAt: string;
    user: { name: string | null; phone: string };
  }[];
};

export default function SellerOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/seller/overview")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((json: Overview) => setData(json))
      .catch(() => setError("Could not load overview. Are you logged in as the seller?"));
  }, []);

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1C3A2A]">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today's revenue" value={inr(data.todayRevenue)} />
        <Stat label="This month" value={inr(data.monthRevenue)} />
        <Stat label="Pending orders" value={String(data.pendingOrders)} />
        <Stat label="Active subscriptions" value={String(data.activeSubscriptions)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-[#1C3A2A]">Low stock (10 or fewer)</h2>
          {data.lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-[#1C3A2A]/60">Nothing is running low. 🎉</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-[#1C3A2A]">{p.nameEn}</span>
                  <Pill tone={p.stock === 0 ? "red" : "amber"}>{p.stock} left</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#1C3A2A]">Recent orders</h2>
            <Link href="/seller/orders" className="text-sm font-semibold text-[#2F6B3F] hover:underline">
              View all
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-[#1C3A2A]/60">No orders yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-[#1C3A2A]">{o.code}</p>
                    <p className="text-xs text-[#1C3A2A]/60">
                      {o.user.name ?? o.user.phone} · {inr(o.total)}
                    </p>
                  </div>
                  <Pill tone={statusTone(o.status)}>{o.status.replaceAll("_", " ")}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}