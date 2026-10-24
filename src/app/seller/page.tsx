"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Pill, Stat, inr, statusTone } from "./ui";
import { NURSERY_FEATURE_KEYS, NURSERY_FEATURE_META, readNurseryFeatures } from "@/lib/nursery-features";

type Overview = {
  nurseryName?: string;
  todayRevenue: number;
  monthRevenue: number;
  pendingOrders: number;
  activeSubscriptions: number;
  locationsCount?: number;
  features?: unknown;
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

  // Mission F: the franchise switchboard as the nursery admin sees it —
  // what the super admin has enabled for THIS nursery.
  const features = readNurseryFeatures(data.features);
  const offModules = NURSERY_FEATURE_KEYS.filter((k) => !features[k]);
  const locationsCount = typeof data.locationsCount === "number" ? data.locationsCount : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-[#1C3A2A]">Overview</h1>
        {data.nurseryName ? <p className="text-sm font-semibold text-[#1C3A2A]/70">🏡 {data.nurseryName}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Today's revenue" value={inr(data.todayRevenue)} />
        <Stat label="This month" value={inr(data.monthRevenue)} />
        <Stat label="Pending orders" value={String(data.pendingOrders)} />
        <Stat label="Active subscriptions" value={String(data.activeSubscriptions)} />
        <Stat
          label="Locations served"
          value={locationsCount === null ? "—" : String(locationsCount)}
          sub={features.locations ? "manage under Locations" : "managed by Tomavine"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#1C3A2A]">Your Tomavine modules</h2>
            {offModules.length === 0 ? (
              <Pill tone="green">All enabled</Pill>
            ) : (
              <Pill tone="amber">{offModules.length} off</Pill>
            )}
          </div>
          <p className="mt-1 text-xs text-[#1C3A2A]/60">
            What you can do on Tomavine. Disappeared something you need? Contact Tomavine support — the platform team
            flips these for you.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {NURSERY_FEATURE_KEYS.map((key) => (
              <li key={key}>
                <Pill tone={features[key] ? "green" : "gray"}>
                  {features[key] ? "✓" : "✕"} {NURSERY_FEATURE_META[key].label}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>

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
      </div>

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
  );
}
