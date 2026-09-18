"use client";

import { useEffect, useState } from "react";
import { Card, Empty, ErrBox, Loading, Pill, formatDateTime } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  meta: unknown;
  at: string;
  actorName: string | null;
  actorPhone: string;
  actorRole: string;
};

function metaEntries(meta: unknown): [string, string][] {
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return [];
  }
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    out.push([k, typeof v === "string" ? v : JSON.stringify(v)]);
  }
  return out;
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch("/api/admin/audit")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data && Array.isArray(data.logs)) {
          setRows(data.logs);
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

  if (error) {
    return (
      <ErrBox>
        <p className="mb-2">Could not load the audit log — please retry.</p>
        <button type="button" onClick={() => setReload((x) => x + 1)} className="text-sm font-bold underline">
          Retry
        </button>
      </ErrBox>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={SERIF}>
        Audit log
      </h1>
      <p className="text-xs text-[#8E9A84]">Every admin action is recorded here — latest 50 entries.</p>

      {rows.length === 0 ? (
        <Empty emoji="🧾" title="No audit entries yet" text="Verify or reject a nursery to create the first entry." />
      ) : (
        <div className="space-y-3">
          {rows.map((l) => (
            <Card key={l.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="forest">{l.action}</Pill>
                  <span className="font-mono text-xs text-[#66735F]">{l.entity}</span>
                </div>
                <span className="text-xs text-[#8E9A84]">{formatDateTime(l.at)}</span>
              </div>
              <p className="mt-2 text-xs text-[#66735F]">
                by <b className="text-[#20291D]">{l.actorName ?? l.actorPhone}</b> ({l.actorRole}) · {l.actorPhone}
              </p>
              {metaEntries(l.meta).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {metaEntries(l.meta).map(([k, v]) => (
                    <span key={k} className="rounded-xl bg-[#F7F3E8] px-3 py-1 text-xs">
                      <span className="font-bold text-[#5F7A58]">{k}: </span>
                      <span className="text-[#20291D]">{v}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}