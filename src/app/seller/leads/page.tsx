"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill, inr } from "../ui";
import { whatsappLink } from "@/lib/settings-shared";

// Mission S4: leads console = pipeline + quotation builder. Sellers
// move a lead along new -> contacted -> quoted -> won / lost, build a
// line-item quotation (prefilled from the buyer's request) and share
// the public /quote/<token> link with the buyer. The legacy
// single-amount quote API still exists, but this console now always
// builds itemized quotations.

type QuoteRow = {
  id: string;
  amount: number;
  total: number;
  transport: number;
  status: string;
  validUntil: string | null;
  token: string | null;
  createdAt: string;
};

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
  quotes: QuoteRow[];
};

type BuilderRow = { name: string; qty: string; unit: string; note: string };

const LEAD_STEPS = ["new", "contacted", "quoted", "won", "lost"] as const;

function fmtDate(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function quoteTotal(q: QuoteRow): number {
  return q.total > 0 ? q.total : q.amount;
}

function quoteTone(status: string): "green" | "amber" | "red" | "gray" | "blue" {
  if (status === "accepted") {
    return "green";
  }
  if (status === "viewed") {
    return "blue";
  }
  if (status === "declined") {
    return "red";
  }
  if (status === "sent") {
    return "amber";
  }
  return "gray";
}

function leadTone(status: string): "green" | "amber" | "red" | "gray" | "blue" {
  if (status === "won" || status === "quoted") {
    return "green";
  }
  if (status === "lost") {
    return "red";
  }
  if (status === "contacted") {
    return "blue";
  }
  return "amber";
}

export default function SellerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Quotation builder state (one lead at a time).
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [transport, setTransport] = useState("0");
  const [validDays, setValidDays] = useState("7");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  // Just-sent quotation, shown with copy + WhatsApp share actions.
  const [lastQuote, setLastQuote] = useState<{ leadId: string; ref: string; token: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  function openBuilder(lead: Lead) {
    const pre: BuilderRow[] =
      lead.items && lead.items.length > 0
        ? lead.items.map((it) => ({
            name: it.name,
            qty: String(it.qty),
            unit: "",
            note: typeof it.note === "string" ? it.note : "",
          }))
        : [
            {
              name: lead.product ? lead.product.nameEn : "",
              qty: String(lead.qty),
              unit: "",
              note: "",
            },
          ];

    setRows(pre);
    setTransport("0");
    setValidDays("7");
    setNote("");
    setError("");
    setLastQuote(null);
    setBuildingId(lead.id);
  }

  function updateRow(ix: number, patch: Partial<BuilderRow>) {
    setRows(rows.map((r, i) => (i === ix ? { ...r, ...patch } : r)));
  }

  function builderTotal(): number {
    let sum = 0;
    for (const r of rows) {
      sum += (parseInt(r.qty, 10) || 0) * (parseInt(r.unit, 10) || 0);
    }
    return sum + (parseInt(transport, 10) || 0);
  }

  async function submitQuote(lead: Lead) {
    const items = rows.map((r) => ({
      name: r.name.trim(),
      qty: parseInt(r.qty, 10) || 0,
      unit: parseInt(r.unit, 10) || 0,
      note: r.note.trim().length > 0 ? r.note.trim() : null,
    }));

    for (const it of items) {
      if (it.name.length === 0) {
        setError("Every line needs an item name.");
        return;
      }
      if (it.qty < 1) {
        setError("Quantities must be whole numbers of 1 or more.");
        return;
      }
      if (it.unit < 0) {
        setError("Unit prices must be 0 or more.");
        return;
      }
    }

    const tr = parseInt(transport, 10) || 0;
    const days = parseInt(validDays, 10) || 7;

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/seller/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          items: items,
          transport: tr,
          validDays: days,
          note: note.trim().length > 0 ? note.trim() : null,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        quote?: { ref: string; token: string };
      } | null;

      if (!res.ok || !data || !data.quote) {
        throw new Error(data && data.error ? data.error : "Could not send the quotation");
      }

      setLastQuote({ leadId: lead.id, ref: data.quote.ref, token: data.quote.token });
      setBuildingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the quotation");
    } finally {
      setSending(false);
    }
  }

  async function setPipeline(lead: Lead, status: string) {
    setBusyId(lead.id);
    setError("");

    try {
      const res = await fetch("/api/seller/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, status: status }),
      });

      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(d && d.error ? d.error : "Could not update the pipeline");
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the pipeline");
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(token: string | null) {
    if (!token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.origin + "/quote/" + token);
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      setError("Copy failed - open the link and copy it from the address bar.");
    }
  }

  if (loading && leads.length === 0) {
    return <p className="text-[#1C3A2A]/60">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1C3A2A]">Leads &amp; quotations</h1>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {leads.length === 0 ? <p className="text-[#1C3A2A]/60">No enquiries yet.</p> : null}

      {leads.map((lead) => {
        const busy = busyId === lead.id;
        const preorder = lead.type === "PREORDER";
        const rfq = lead.type === "RFQ";
        const neededBy = fmtDate(lead.neededBy);
        const place = [lead.city, lead.state].filter((x) => x && x.length > 0).join(", ");

        return (
          <Card key={lead.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{lead.company}</p>
                <p className="text-sm text-[#1C3A2A]/70">
                  {lead.qty.toLocaleString("en-IN")} &#215; {lead.product ? lead.product.nameEn : "multi-item enquiry"}
                </p>
                <p className="text-xs text-[#1C3A2A]/50">
                  {place}
                  {lead.pincode ? " - " + lead.pincode : ""} - {lead.product ? lead.product.category : "RFQ"}
                </p>
                {lead.phone ? (
                  <p className="mt-1 text-sm font-semibold text-[#1C3A2A]">
                    &#128222;{" "}
                    <a className="underline" href={"tel:" + lead.phone}>
                      {lead.phone}
                    </a>
                  </p>
                ) : null}
                {neededBy ? <p className="text-xs font-semibold text-[#8a5a12]">Needed by {neededBy}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rfq ? <Pill tone="blue">RFQ</Pill> : null}
                <Pill tone={preorder ? "blue" : "green"}>{preorder ? "PRE-ORDER" : "BULK"}</Pill>
                <Pill tone={leadTone(lead.status)}>{lead.status}</Pill>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/40">
                Pipeline
              </span>
              {LEAD_STEPS.map((step) => {
                const active = lead.status === step;

                return (
                  <button
                    key={step}
                    type="button"
                    disabled={busy || active}
                    onClick={() => setPipeline(lead, step)}
                    className={
                      active
                        ? "rounded-full bg-[#2F6B3F] px-3 py-1 text-xs font-semibold text-white"
                        : "rounded-full border border-[#1C3A2A]/15 px-3 py-1 text-xs font-semibold text-[#1C3A2A]/60 transition hover:border-[#2F6B3F] hover:text-[#2F6B3F] disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    {step}
                  </button>
                );
              })}
            </div>

            {preorder ? (
              <p className="mt-3 rounded-xl bg-[#EDF2E6] px-3 py-2 text-xs font-semibold text-[#24562F]">
                Pre-order - no payment taken. Call / WhatsApp the buyer to confirm availability and dates.
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

            {lead.quotes.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/40">Quotations</p>
                {lead.quotes.map((q) => (
                  <div
                    key={q.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E4E0CE] px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs font-semibold text-[#1C3A2A]/70">
                      {q.token ? q.token.slice(0, 8).toUpperCase() : "legacy"}
                    </span>
                    <span className="font-semibold text-[#1C3A2A]">{inr(quoteTotal(q))}</span>
                    <Pill tone={quoteTone(q.status)}>{q.status}</Pill>
                    <span className="text-xs text-[#1C3A2A]/50">
                      {q.validUntil ? "valid until " + fmtDate(q.validUntil) : "no expiry"}
                    </span>
                    {q.token ? (
                      <span className="flex items-center gap-2">
                        <a
                          className="rounded-lg border border-[#2F6B3F] px-3 py-1 text-xs font-semibold text-[#2F6B3F] transition hover:bg-[#2F6B3F]/10"
                          href={"/quote/" + q.token}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                        <button
                          type="button"
                          onClick={() => copyLink(q.token)}
                          className="rounded-lg border border-[#1C3A2A]/20 px-3 py-1 text-xs font-semibold text-[#1C3A2A]/70 transition hover:bg-[#1C3A2A]/5"
                        >
                          {copied === q.token ? "Copied" : "Copy link"}
                        </button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {lastQuote && lastQuote.leadId === lead.id ? (
              <div className="mt-3 rounded-xl bg-[#EDF2E6] px-3 py-3 text-sm text-[#24562F]">
                <p className="font-semibold">Quotation {lastQuote.ref} sent.</p>
                <p className="mt-1 break-all text-xs">
                  Public link: /quote/{lastQuote.token} - send it to the buyer.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(lastQuote.token)}
                    className="rounded-lg border border-[#24562F] px-3 py-1 text-xs font-semibold text-[#24562F] transition hover:bg-[#24562F]/10"
                  >
                    {copied === lastQuote.token ? "Copied" : "Copy link"}
                  </button>
                  {whatsapp ? (
                    <button
                      type="button"
                      onClick={() => {
                        const url = window.location.origin + "/quote/" + lastQuote.token;
                        window.open(
                          whatsappLink(whatsapp, "Tomavine quotation " + lastQuote.ref + " - " + url),
                          "_blank",
                          "noopener",
                        );
                      }}
                      className="rounded-lg bg-[#2F6B3F] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#255732]"
                    >
                      Share on WhatsApp
                    </button>
                  ) : null}
                </div>
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

            {buildingId === lead.id ? (
              <div className="mt-4 rounded-2xl border border-[#2F6B3F]/30 bg-[#F7F3E8] p-4">
                <p className="font-bold text-[#1C3A2A]">Build quotation</p>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E4E0CE] text-left text-xs uppercase tracking-wide text-[#1C3A2A]/50">
                        <th className="py-1 pr-2 font-semibold">Item</th>
                        <th className="py-1 pr-2 font-semibold">Qty</th>
                        <th className="py-1 pr-2 font-semibold">Unit &#8377;</th>
                        <th className="py-1 pr-2 font-semibold">Line note</th>
                        <th className="py-1 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, ix) => (
                        <tr key={ix}>
                          <td className="py-1 pr-2">
                            <input
                              className="w-40 rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1"
                              value={r.name}
                              onChange={(e) => updateRow(ix, { name: e.target.value })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              className="w-20 rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1"
                              inputMode="numeric"
                              value={r.qty}
                              onChange={(e) => updateRow(ix, { qty: e.target.value.replace(/\D/g, "") })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              className="w-24 rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1"
                              inputMode="numeric"
                              value={r.unit}
                              onChange={(e) => updateRow(ix, { unit: e.target.value.replace(/\D/g, "") })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              className="w-40 rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1"
                              value={r.note}
                              onChange={(e) => updateRow(ix, { note: e.target.value })}
                            />
                          </td>
                          <td className="py-1">
                            {rows.length > 1 ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-600"
                                onClick={() => setRows(rows.filter((_, i) => i !== ix))}
                              >
                                Remove
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#2F6B3F]"
                    onClick={() => setRows([...rows, { name: "", qty: "", unit: "", note: "" }])}
                  >
                    + Add line
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-sm font-medium text-[#1C3A2A]">
                    Transport &#8377;
                    <input
                      className="mt-1 block w-28 rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1"
                      inputMode="numeric"
                      value={transport}
                      onChange={(e) => setTransport(e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#1C3A2A]">
                    Valid for (days)
                    <input
                      className="mt-1 block w-20 rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1"
                      inputMode="numeric"
                      value={validDays}
                      onChange={(e) => setValidDays(e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#1C3A2A]">
                    Note to buyer
                    <input
                      className="mt-1 block w-64 rounded-lg border border-[#1C3A2A]/20 bg-white px-2 py-1"
                      value={note}
                      placeholder="optional"
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                </div>

                <p className="mt-3 text-sm font-bold text-[#1C3A2A]">Total: {inr(builderTotal())}</p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn onClick={() => submitQuote(lead)} disabled={sending}>
                    {sending ? "Sending..." : "Send quotation"}
                  </Btn>
                  <Btn kind="ghost" onClick={() => setBuildingId(null)} disabled={sending}>
                    Cancel
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <Btn onClick={() => openBuilder(lead)}>New quotation</Btn>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}