"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { whatsappLink } from "@/lib/settings-shared";

type QItem = { name?: unknown; qty?: unknown; unit?: unknown; note?: unknown };

export type QuoteViewProps = {
  token: string;
  ref: string;
  status: string;
  expired: boolean;
  nurseryName: string;
  nurseryPhone: string;
  buyerName: string;
  city: string;
  createdAt: string;
  validUntil: string | null;
  note: string | null;
  transport: number;
  total: number;
  items: QItem[];
};

const RUPEE = String.fromCharCode(8377);

function inr(n: number): string {
  return RUPEE + n.toLocaleString("en-IN");
}

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

export default function QuoteView({ quote }: { quote: QuoteViewProps }) {
  const { t } = useLang();
  const [status, setStatus] = useState(quote.status);
  const [track, setTrack] = useState<{ code: string; trackToken: string } | null>(null);
  const [lapsed, setLapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const answered = status === "accepted" || status === "declined";
  const expired = (quote.expired || lapsed) && !answered;
  const sent = fmtDate(quote.createdAt);
  const validUntil = fmtDate(quote.validUntil);
  const wa =
    quote.nurseryPhone.length > 0
      ? whatsappLink(quote.nurseryPhone, "Tomavine quotation " + quote.ref)
      : "";

  async function answer(action: "accept" | "decline") {
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/quote/" + quote.token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: unknown;
        status?: unknown;
        order?: { code?: unknown; trackToken?: unknown } | null;
      } | null;

      if (!res.ok) {
        if (data && (data.status === "accepted" || data.status === "declined")) {
          setStatus(String(data.status));
          return;
        }
        if (res.status === 410) {
          setLapsed(true);
          return;
        }
        setError(typeof data?.error === "string" ? data.error : t("s4_quote_err"));
        return;
      }

      setStatus(action === "accept" ? "accepted" : "declined");
      if (
        action === "accept" &&
        data !== null &&
        data.order !== null &&
        typeof data.order === "object" &&
        typeof data.order.trackToken === "string"
      ) {
        setTrack({
          code: typeof data.order.code === "string" ? data.order.code : "",
          trackToken: data.order.trackToken,
        });
      }
    } catch {
      setError(t("s4_quote_err"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1
        className="text-3xl font-semibold text-[#1C3A2A]"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {t("s4_quote_title")}
      </h1>
      <p className="mt-1 text-sm text-[#1C3A2A]/60">
        {t("s4_quote_ref")}: <span className="font-semibold">{quote.ref}</span>
      </p>

      {status === "accepted" ? (
        <p className="mt-4 rounded-xl bg-[#EDF2E6] px-4 py-3 text-sm font-semibold text-[#24562F]">
          {t("s4_quote_accepted_ok")}
        </p>
      ) : null}
      {status === "accepted" && track !== null ? (
        <div className="mt-3 rounded-xl border border-[#2F6B3F]/30 bg-[#EDF2E6] px-4 py-3 text-sm">
          <p className="font-semibold text-[#24562F]">{t("s6_order_placed")}</p>
          <a href={"/order/" + track.trackToken} className="mt-1 inline-block font-bold text-[#2F6B3F] underline">
            {t("s6_order_track_cta")} &rarr;
          </a>
        </div>
      ) : null}
      {status === "declined" ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {t("s4_quote_declined_ok")}
        </p>
      ) : null}
      {expired ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {t("s4_quote_expired")}
        </p>
      ) : null}

      <div className="mt-6 rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p className="text-[#1C3A2A]/50">{t("s4_quote_from")}</p>
            <p className="font-semibold text-[#1C3A2A]">{quote.nurseryName}</p>
          </div>
          <div>
            <p className="text-[#1C3A2A]/50">{t("s4_quote_for")}</p>
            <p className="font-semibold text-[#1C3A2A]">{quote.buyerName}</p>
          </div>
          <div>
            <p className="text-[#1C3A2A]/50">{t("s4_quote_sent")}</p>
            <p className="font-semibold text-[#1C3A2A]">{sent.length > 0 ? sent : "-"}</p>
          </div>
          <div>
            <p className="text-[#1C3A2A]/50">{t("s4_quote_valid_until")}</p>
            <p className="font-semibold text-[#1C3A2A]">
              {validUntil.length > 0 ? validUntil : t("s4_quote_no_expiry")}
            </p>
          </div>
        </div>
      </div>

      {quote.items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#1C3A2A]/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E0CE] text-left text-xs uppercase tracking-wide text-[#1C3A2A]/50">
                <th className="px-4 py-2 font-semibold">{t("s4_quote_item")}</th>
                <th className="px-4 py-2 font-semibold">{t("s4_quote_qty")}</th>
                <th className="px-4 py-2 font-semibold">{t("s4_quote_unit")}</th>
                <th className="px-4 py-2 text-right font-semibold">{t("s4_quote_amount")}</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it, ix) => {
                const qty = Number(it.qty) || 0;
                const unit = Number(it.unit) || 0;
                const name = typeof it.name === "string" ? it.name : "-";
                const note = typeof it.note === "string" && it.note.length > 0 ? it.note : null;

                return (
                  <tr key={ix} className="border-b border-[#E4E0CE]/60 align-top last:border-0">
                    <td className="px-4 py-2 font-medium text-[#1C3A2A]">
                      {name}
                      {note ? <p className="text-xs text-[#1C3A2A]/50">{note}</p> : null}
                    </td>
                    <td className="px-4 py-2 text-[#1C3A2A]/70">{qty.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 text-[#1C3A2A]/70">{inr(unit)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#1C3A2A]">
                      {inr(qty * unit)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b border-[#E4E0CE]/60">
                <td className="px-4 py-2 text-[#1C3A2A]/70" colSpan={3}>
                  {t("s4_quote_transport")}
                </td>
                <td className="px-4 py-2 text-right text-[#1C3A2A]/70">{inr(quote.transport)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-[#1C3A2A]" colSpan={3}>
                  {t("s4_quote_total")}
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#1C3A2A]">{inr(quote.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm">
          <span className="text-sm font-semibold text-[#1C3A2A]">{t("s4_quote_total")}</span>
          <span className="text-lg font-bold text-[#1C3A2A]">{inr(quote.total)}</span>
        </div>
      )}

      {quote.note ? (
        <div className="mt-4 rounded-2xl bg-[#F7F3E8] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/50">
            {t("s4_quote_note")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#1C3A2A]/80">{quote.note}</p>
        </div>
      ) : null}

      {!answered && !expired ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => answer("accept")}
            className="rounded-xl bg-[#2F6B3F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#255732] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("s4_quote_sending") : t("s4_quote_accept")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => answer("decline")}
            className="rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("s4_quote_decline")}
          </button>
        </div>
      ) : null}

      {wa.length > 0 ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-xl border border-[#2F6B3F] px-5 py-2.5 text-sm font-semibold text-[#2F6B3F] transition hover:bg-[#2F6B3F]/10"
        >
          {t("s4_quote_wa")}
        </a>
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}