"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, ErrBox, Loading, Pill, Stat, Btn, inr } from "./ui";

type StatusCount = { status: string; count: number };
type RoleCount = { role: string; count: number };

type Stats = {
  nurseries: StatusCount[];
  orders: StatusCount[];
  users: RoleCount[];
  leads: StatusCount[];
  revenueDelivered: number;
};

function sc(list: StatusCount[], key: string): number {
  return list.find((x) => x.status === key)?.count ?? 0;
}

function rc(list: RoleCount[], key: string): number {
  return list.find((x) => x.role === key)?.count ?? 0;
}

function total(list: { count: number }[]): number {
  return list.reduce((sum, x) => sum + x.count, 0);
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
        Overview
      </h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Nurseries" value={String(total(stats.nurseries))} hint={`${sc(stats.nurseries, "VERIFIED")} verified`} />
        <Stat
          label="Pending verification"
          value={String(pendingNurseries)}
          hint={pendingNurseries > 0 ? "Needs your action" : "All clear"}
        />
        <Stat label="Orders" value={String(total(stats.orders))} hint={`${sc(stats.orders, "DELIVERED")} delivered`} />
        <Stat label="Users" value={String(total(stats.users))} hint={`${rc(stats.users, "SELLER")} sellers`} />
        <Stat label="New leads" value={String(sc(stats.leads, "new"))} hint={`${sc(stats.leads, "quoted")} quoted`} />
        <Stat label="Delivered revenue" value={inr(stats.revenueDelivered)} hint="COD orders marked delivered" />
        <Stat label="Rejected nurseries" value={String(sc(stats.nurseries, "REJECTED"))} />
      </div>

      {pendingNurseries > 0 ? (
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

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card>
          <h2 className="mb-3 text-lg font-semibold text-[#20291D]">Users & leads</h2>
          <div className="space-y-2">
            {stats.users.map((u) => (
              <div key={u.role} className="flex items-center justify-between gap-2 text-sm">
                <Pill tone="sky">{u.role}</Pill>
                <span className="font-bold text-[#20291D]">{u.count}</span>
              </div>
            ))}
            {stats.leads.map((l) => (
              <div key={l.status} className="flex items-center justify-between gap-2 text-sm">
                <Pill tone="amber">lead · {l.status}</Pill>
                <span className="font-bold text-[#20291D]">{l.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}