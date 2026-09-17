"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill, inr } from "../ui";

type Lead = {
  id: string;
  qty: number;
  city: string;
  company: string;
  notes: string | null;
  status: string;
  product: { id: string; nameEn: string; category: string };
  quotes: { id: string; amount: number; status: string }[];
};

export default function SellerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/seller/leads");

      if (!res.ok) throw new Error("failed");

      const data = await res.json();
      setLeads(data.leads);
      setError("");
    } catch {
      setError("Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendQuote(lead: Lead) {
    const amount = Number(amounts[lead.id] ?? "");

    if (!Number.isInteger(amount) || amount < 1) {
      setError("Enter a valid quote amount in rupees.");
      return;
    }

    setBusyId(lead.id);
    setError("");

    try {
      const res = await fetch("/api/seller/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, amount: amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not send quote");
      }

      setAmounts({ ...amounts, [lead.id]: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send quote");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && leads.length === 0) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1C3A2A]">Bulk quotes</h1>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {leads.length === 0 ? <p className="text-[#1C3A2A]/60">No bulk leads yet.</p> : null}

      {leads.map((lead) => {
        const busy = busyId === lead.id;

        return (
          <Card key={lead.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{lead.company}</p>
                <p className="text-sm text-[#1C3A2A]/70">
                  {lead.qty.toLocaleString("en-IN")} × {lead.product.nameEn}
                </p>
                <p className="text-xs text-[#1C3A2A]/50">
                  {lead.city} · {lead.product.category}
                </p>
              </div>
              <Pill tone={lead.status === "quoted" ? "green" : "amber"}>{lead.status}</Pill>
            </div>

            {lead.notes ? (
              <p className="mt-3 rounded-xl bg-[#F7F3E8] px-3 py-2 text-sm text-[#1C3A2A]/80">{lead.notes}</p>
            ) : null}

            {lead.quotes.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-[#1C3A2A]/70">
                {lead.quotes.map((q) => (
                  <li key={q.id}>
                    You quoted {inr(q.amount)} · {q.status}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium text-[#1C3A2A]">
                Your quote (₹)
                <input
                  className="mt-1 w-44 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={amounts[lead.id] ?? ""}
                  inputMode="numeric"
                  placeholder="e.g. 110000"
                  onChange={(e) =>
                    setAmounts({ ...amounts, [lead.id]: e.target.value.replace(/\D/g, "") })
                  }
                />
              </label>
              <Btn onClick={() => sendQuote(lead)} disabled={busy}>
                {busy ? "Sending…" : "Send quote"}
              </Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}