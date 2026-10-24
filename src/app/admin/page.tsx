"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Empty, ErrBox, Loading, Pill, Stat, Btn, inr } from "./ui";

type StatusCount = { status: string; count: number };
type RoleCount = { role: string; count: number };

type Stats = {
  nurseries: StatusCount[] | null;
  orders: StatusCount[] | null;
  users: RoleCount[] | null;
  leads: StatusCount[] | null;
  revenueDelivered: number | null;
};

function sc(list: StatusCount[] | null, key: string): number {
  return list?.find((x) => x.status === key)?.count ?? 0;
}

function rc(list: RoleCount[] | null, key: string): number {
  return list?.find((x) => x.role === key)?.count ?? 0;
}

function total(list: { count: number }[] | null): number {
  return list?.reduce((sum, x) => sum + x.count, 0) ?? 0;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch("/api/admin/stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data) {
          setStats(data);
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

  if (loading) {
    return <Loading />;
  }

  if (error || !stats) {
    return (
      <ErrBox>
        <p className="mb-2">Could not load stats — please retry.</p>
        <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
          Retry
        </Btn>
      </ErrBox>
    );
  }

  const pendingNurseries = sc(stats.nurseries, "PENDING");
  const anySection =
    stats.nurseries !== null ||
    stats.orders !== null ||
    stats.users !== null ||
    stats.leads !== null ||
    stats.revenueDelivered !== null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
        Overview
      </h1>

      {!anySection ? (
        <Empty
          emoji="🛡️"
          title="No dashboard sections for your access level"
          text="Your admin account doesn't include any overview sections yet — use the sidebar to reach the areas you can work in, or ask the founder to widen your scopes."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {stats.nurseries !== null ? (
              <>
                <Stat
                  label="Nurseries"
                  value={String(total(stats.nurseries))}
                  hint={`${sc(stats.nurseries, "VERIFIED")} verified`}
                />
                <Stat
                  label="Pending verification"
                  value={String(pendingNurseries)}
                  hint={pendingNurseries > 0 ? "Needs your action" : "All clear"}
                />
                <Stat label="Rejected nurseries" value={String(sc(stats.nurseries, "REJECTED"))} />
              </>
            ) : null}
            {stats.orders !== null ? (
              <Stat label="Orders" value={String(total(stats.orders))} hint={`${sc(stats.orders, "DELIVERED")} delivered`} />
            ) : null}
            {stats.users !== null ? (
              <Stat label="Users" value={String(total(stats.users))} hint={`${rc(stats.users, "SELLER")} sellers`} />
            ) : null}
            {stats.leads !== null ? (
              <Stat label="New leads" value={String(sc(stats.leads, "new"))} hint={`${sc(stats.leads, "quoted")} quoted`} />
            ) : null}
            {stats.revenueDelivered !== null ? (
              <Stat label="Delivered revenue" value={inr(stats.revenueDelivered)} hint="COD orders marked delivered" />
            ) : null}
          </div>

          {stats.nurseries !== null && pendingNurseries > 0 ? (
            <Card className="border-amber-300 bg-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-800">
                  🚨 {pendingNurseries} nursery{pendingNurseries > 1 ? "ies" : ""} waiting for physical verification.
                </p>
                <Btn href="/admin/nurseries" size="sm">
                  Open queue →
                </Btn>
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="text-lg font-semibold text-[#20291D]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              How Tomavine fits together
            </h2>
            <p className="mt-1 text-xs text-[#8E9A84]">
              Three roles, one marketplace — like a franchise network: you run the platform, each nursery admin runs their own
              nursery, customers shop.
            </p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-[#F7F3E8] p-3">
                <p className="font-bold text-[#20291D]">🛡️ You — super admin</p>
                <p className="mt-1 text-xs text-[#66735F]">
                  Onboard nurseries + their owner accounts, set what each nursery may do (modules &amp; payments), curate the
                  category tree and the plant catalog.
                </p>
              </div>
              <div className="rounded-xl bg-[#F7F3E8] p-3">
                <p className="font-bold text-[#20291D]">🏡 Nursery admins</p>
                <p className="mt-1 text-xs text-[#66735F]">
                  Each owner logs into <span className="font-semibold">/seller</span> with their phone: add their plants,
                  manage the pincodes they serve, handle their orders — only the modules you enabled for them.
                </p>
              </div>
              <div className="rounded-xl bg-[#F7F3E8] p-3">
                <p className="font-bold text-[#20291D]">🛒 Customers</p>
                <p className="mt-1 text-xs text-[#66735F]">
                  Shop the storefront. A nursery&apos;s service areas and payment switches (COD / online) shape what they see
                  at checkout.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn href="/admin/nurseries" size="sm" variant="outline">
                Onboard a nursery
              </Btn>
              <Btn href="/admin/plants" size="sm" variant="outline">
                Add plants
              </Btn>
              <Btn href="/admin/locations" size="sm" variant="outline">
                Location master
              </Btn>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {stats.orders !== null ? (
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#20291D]">Order pipeline</h2>
                  <Link href="/admin/orders" className="text-sm font-bold text-[#2F6B3F] hover:underline">
                    View orders →
                  </Link>
                </div>
                <div className="space-y-2">
                  {stats.orders.length === 0 ? (
                    <p className="text-sm text-[#66735F]">No orders yet.</p>
                  ) : (
                    stats.orders.map((o) => (
                      <div key={o.status} className="flex items-center justify-between gap-2 text-sm">
                        <Pill tone="cream">{o.status.replaceAll("_", " ")}</Pill>
                        <span className="font-bold text-[#20291D]">{o.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            ) : null}

            {stats.users !== null ? (
              <Card>
                <h2 className="mb-3 text-lg font-semibold text-[#20291D]">Users & leads</h2>
                <div className="space-y-2">
                  {stats.users.map((u) => (
                    <div key={u.role} className="flex items-center justify-between gap-2 text-sm">
                      <Pill tone="sky">{u.role}</Pill>
                      <span className="font-bold text-[#20291D]">{u.count}</span>
                    </div>
                  ))}
                  {stats.leads !== null
                    ? stats.leads.map((l) => (
                        <div key={l.status} className="flex items-center justify-between gap-2 text-sm">
                          <Pill tone="amber">lead · {l.status}</Pill>
                          <span className="font-bold text-[#20291D]">{l.count}</span>
                        </div>
                      ))
                    : null}
                </div>
              </Card>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}