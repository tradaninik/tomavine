"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill, inr } from "../ui";
import { whatsappLink } from "@/lib/settings-shared";

// Mission S2: leads now carry phone, pincode, state, a needed-by
// date and a BULK / PREORDER type (pre-orders come from out-of-stock
// products — no payment is taken, the nursery calls/WhatsApp to
// confirm before dispatch).
type Lead = {
  id: string;
  qty: number;
  city: string;
  company: string;
  phone: string | null;
  pincode: string | null;
  state: string | null;
  neededBy: string | null;
  type: string;
  notes: string | null;
  status: string;
  product: { id: string; nameEn: string; category: string } | null;
  items: { name: string; qty: number; note?: string | null }[] | null;
  quotes: { id: string; amount: number; status: string }[];
};

function formatNeededBy(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

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

  // Mission S3: WhatsApp buttons appear only when the owner has set a
  // number in the seller console - never a placeholder.
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.whatsappNumber === "string") {
          setWhatsapp(data.whatsappNumber);
        }
      })
      .catch(() => undefined);
  }, []);

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
      <h1 className="text-2xl font-bold text-[#1C3A2A]">Bulk &amp; pre-order enquiries</h1>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {leads.length === 0 ? <p className="text-[#1C3A2A]/60">No enquiries yet.</p> : null}

      {leads.map((lead) => {
        const busy = busyId === lead.id;
        const preorder = lead.type === "PREORDER";
        const rfq = lead.type === "RFQ";
        const neededBy = formatNeededBy(lead.neededBy);
        const place = [lead.city, lead.state].filter((x) => x && x.length > 0).join(", ");

        return (
          <Card key={lead.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{lead.company}</p>
                <p className="text-sm text-[#1C3A2A]/70">
                  {lead.qty.toLocaleString("en-IN")} × {lead.product ? lead.product.nameEn : "multi-item enquiry"}
                </p>
                <p className="text-xs text-[#1C3A2A]/50">
                  {place}
                  {lead.pincode ? ` · ${lead.pincode}` : ""} · {lead.product ? lead.product.category : "RFQ"}
                </p>
                {lead.phone ? (
                  <p className="mt-1 text-sm font-semibold text-[#1C3A2A]">
                    📞{" "}
                    <a className="underline" href={`tel:${lead.phone}`}>
                      {lead.phone}
                    </a>
                  </p>
                ) : null}
                {neededBy ? <p className="text-xs font-semibold text-[#8a5a12]">🗓 Needed by {neededBy}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rfq ? <Pill tone="blue">RFQ</Pill> : null}
                <Pill tone={preorder ? "blue" : "green"}>{preorder ? "🌱 PRE-ORDER" : "🚜 BULK"}</Pill>
                <Pill tone={lead.status === "quoted" ? "green" : "amber"}>{lead.status}</Pill>
              </div>
            </div>

            {preorder ? (
              <p className="mt-3 rounded-xl bg-[#EDF2E6] px-3 py-2 text-xs font-semibold text-[#24562F]">
                Pre-order — no payment taken. Call / WhatsApp the buyer to confirm availability and dates.
              </p>
            ) : null}

            {lead.notes ? (
              <p className="mt-3 rounded-xl bg-[#F7F3E8] px-3 py-2 text-sm text-[#1C3A2A]/80">{lead.notes}</p>
            ) : null}

            {lead.items && lead.items.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E4E0CE] text-left text-xs uppercase tracking-wide text-[#1C3A2A]/50">
                      <th className="py-1 pr-3 font-semibold">Requested items</th>
                      <th className="py-1 pr-3 font-semibold">Qty</th>
                      <th className="py-1 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lead.items.map((it, ix) => (
                      <tr key={ix} className="border-b border-[#E4E0CE]/60 last:border-0">
                        <td className="py-1 pr-3 font-medium text-[#1C3A2A]">{it.name}</td>
                        <td className="py-1 pr-3 text-[#1C3A2A]/70">{it.qty.toLocaleString("en-IN")}</td>
                        <td className="py-1 text-[#1C3A2A]/50">{it.note ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {whatsapp ? (
              <a
                href={whatsappLink(
                  whatsapp,
                  "Tomavine enquiry - " +
                    (lead.items && lead.items.length > 0
                      ? lead.items.map((it) => it.name + " x " + it.qty).join(", ")
                      : lead.qty + " x " + (lead.product ? lead.product.nameEn : "plants")) +
                    " - " +
                    lead.city
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24562F]"
              >
                WhatsApp
              </a>
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
