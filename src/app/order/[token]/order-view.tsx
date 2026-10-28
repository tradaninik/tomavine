"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { whatsappLink } from "@/lib/settings-shared";

type OItem = { name: string; qty: number; unit: number; note: string | null };

// S6-C: informational settlement snapshot written by the seller
// (advance / balance UPI receipts in Order.meta.settlement). A null
// part simply means not marked yet - the card renders only when at
// least one part exists.
export type SettlementPart = { amount: number; at: string; upiRef: string | null };
export type SettlementView = { advance: SettlementPart | null; balance: SettlementPart | null };

export type OrderViewProps = {
  token: string;
  code: string;
  status: string;
  nurseryName: string;
  nurseryPhone: string;
  buyerName: string;
  city: string;
  placedAt: string;
  promisedDate: string | null;
  deliveryOtp: string | null;
  items: OItem[];
  transport: number;
  subtotal: number;
  total: number;
  note: string | null;
  buyerConfirmedAt: string | null;
  settlement: SettlementView | null;
  events: { id: string; status: string; note: string | null; actorRole: string; createdAt: string }[];
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

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The storefront status keys (st_*) already ship in all six languages.
function statusKeyOf(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "st_confirmed";
    case "PREPARING":
      return "st_preparing";
    case "OUT_FOR_DELIVERY":
      return "st_out";
    case "DELIVERED":
      return "st_delivered";
    case "CANCELLED":
      return "st_cancelled";
    case "REJECTED":
      return "st_rejected";
    default:
      return "st_pending";
  }
}

const LADDER = [
  { status: "PENDING", key: "s6_track_step_pending" },
  { status: "CONFIRMED", key: "s6_track_step_confirmed" },
  { status: "PREPARING", key: "s6_track_step_preparing" },
  { status: "OUT_FOR_DELIVERY", key: "s6_track_step_out" },
  { status: "DELIVERED", key: "s6_track_step_delivered" },
];

function actorKeyOf(role: string): string {
  if (role === "CUSTOMER") {
    return "s6_track_actor_buyer";
  }
  if (role === "SELLER") {
    return "s6_track_actor_seller";
  }
  return "s6_track_actor_admin";
}

export default function OrderView({ order }: { order: OrderViewProps }) {
  const { t } = useLang();
  const [status, setStatus] = useState(order.status);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(order.buyerConfirmedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const placed = fmtDate(order.placedAt);
  const promised = order.promisedDate !== null ? fmtDate(order.promisedDate) : "";
  const confirmed = confirmedAt !== null;
  const canConfirm = !confirmed && (status === "OUT_FOR_DELIVERY" || status === "DELIVERED");
  const terminalBad = status === "CANCELLED" || status === "REJECTED";
  const stepIdx = LADDER.findIndex((s) => s.status === status);
  const wa =
    order.nurseryPhone.length > 0
      ? whatsappLink(order.nurseryPhone, "Tomavine order " + order.code)
      : "";

  const advPart = order.settlement === null ? null : order.settlement.advance;
  const balPart = order.settlement === null ? null : order.settlement.balance;
  const showPayCard = advPart !== null || balPart !== null;
  const payRows = showPayCard
    ? [
        {
          label: t("s6c_pay_advance"),
          marked: advPart !== null,
          amount: advPart !== null ? advPart.amount : null,
          dateText:
            advPart !== null && advPart.at.length > 0
              ? t("s6c_pay_received_on", { date: fmtDate(advPart.at) })
              : "",
          refText:
            advPart !== null && advPart.upiRef !== null
              ? t("s6c_pay_upi_ref", { ref: advPart.upiRef })
              : "",
          pendingText: t("s6c_pay_pending"),
        },
        {
          label: t("s6c_pay_balance"),
          marked: balPart !== null,
          amount:
            balPart !== null
              ? balPart.amount
              : advPart !== null
                ? Math.max(0, order.total - advPart.amount)
                : null,
          dateText:
            balPart !== null && balPart.at.length > 0
              ? t("s6c_pay_received_on", { date: fmtDate(balPart.at) })
              : "",
          refText:
            balPart !== null && balPart.upiRef !== null
              ? t("s6c_pay_upi_ref", { ref: balPart.upiRef })
              : "",
          pendingText: t("s6c_pay_due_delivery"),
        },
      ]
    : [];

  async function confirmReceipt() {
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/order/" + order.token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown; buyerConfirmedAt?: unknown }
        | null;

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : t("s6_track_confirm_err"));
        return;
      }

      setConfirmedAt(
        typeof data?.buyerConfirmedAt === "string" ? data.buyerConfirmedAt : new Date().toISOString(),
      );
      setStatus("DELIVERED");
    } catch {
      setError(t("s6_track_confirm_err"));
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
        {t("s6_track_title")}
      </h1>
      <p className="mt-1 text-sm text-[#1C3A2A]/60">
        {t("s6_track_order_no")}: <span className="font-semibold">{order.code}</span>
      </p>

      {confirmed ? (
        <p className="mt-4 rounded-xl bg-[#EDF2E6] px-4 py-3 text-sm font-semibold text-[#24562F]">
          {t("s6_track_confirmed_ok")}
        </p>
      ) : null}
      {terminalBad ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {status === "CANCELLED" ? t("s6_track_cancelled") : t("s6_track_rejected")}
        </p>
      ) : null}

      {!terminalBad ? (
        <div className="mt-6 rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {LADDER.map((s, i) => {
              const done = stepIdx >= i;
              const now = stepIdx === i;
              const cls = now
                ? "rounded-full bg-[#2F6B3F] px-3 py-1 text-xs font-bold text-white"
                : done
                  ? "rounded-full bg-[#EDF2E6] px-3 py-1 text-xs font-semibold text-[#24562F]"
                  : "rounded-full border border-[#1C3A2A]/15 px-3 py-1 text-xs font-semibold text-[#1C3A2A]/40";
              return (
                <div key={s.status} className="flex items-center gap-2">
                  <span className={cls}>{t(s.key)}</span>
                  {i < LADDER.length - 1 ? (
                    <span className="text-[#1C3A2A]/30" aria-hidden="true">
                      &rarr;
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p className="text-[#1C3A2A]/50">{t("s6_track_supplier")}</p>
            <p className="font-semibold text-[#1C3A2A]">{order.nurseryName}</p>
          </div>
          <div>
            <p className="text-[#1C3A2A]/50">{t("s6_track_buyer")}</p>
            <p className="font-semibold text-[#1C3A2A]">{order.buyerName}</p>
          </div>
          <div>
            <p className="text-[#1C3A2A]/50">{t("s6_track_placed")}</p>
            <p className="font-semibold text-[#1C3A2A]">{placed.length > 0 ? placed : "-"}</p>
          </div>
          <div>
            <p className="text-[#1C3A2A]/50">{t("s6_track_promised")}</p>
            <p className="font-semibold text-[#1C3A2A]">
              {promised.length > 0 ? promised : "-"}
            </p>
          </div>
        </div>
        {order.city.length > 0 ? (
          <p className="mt-2 text-xs text-[#1C3A2A]/60">{order.city}</p>
        ) : null}
      </div>

      {order.items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#1C3A2A]/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E0CE] text-left text-xs uppercase tracking-wide text-[#1C3A2A]/50">
                <th className="px-4 py-2 font-semibold">{t("s6_track_items")}</th>
                <th className="px-4 py-2 font-semibold">{t("s4_quote_qty")}</th>
                <th className="px-4 py-2 font-semibold">{t("s4_quote_unit")}</th>
                <th className="px-4 py-2 text-right font-semibold">{t("s4_quote_amount")}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, ix) => (
                <tr key={ix} className="border-b border-[#E4E0CE]/60 align-top last:border-0">
                  <td className="px-4 py-2 font-medium text-[#1C3A2A]">
                    {it.name}
                    {it.note ? <p className="text-xs text-[#1C3A2A]/50">{it.note}</p> : null}
                  </td>
                  <td className="px-4 py-2 text-[#1C3A2A]/70">{it.qty.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-[#1C3A2A]/70">{inr(it.unit)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#1C3A2A]">
                    {inr(it.qty * it.unit)}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-[#E4E0CE]/60">
                <td className="px-4 py-2 text-[#1C3A2A]/70" colSpan={3}>
                  {t("s6_track_transport")}
                </td>
                <td className="px-4 py-2 text-right text-[#1C3A2A]/70">{inr(order.transport)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-[#1C3A2A]" colSpan={3}>
                  {t("s6_track_total")}
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#1C3A2A]">{inr(order.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {showPayCard ? (
        <div className="mt-4 rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/50">
            {t("s6c_pay_title")}
          </p>
          <div className="mt-3 space-y-3">
            {payRows.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[#E4E0CE]/60 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1C3A2A]">{row.label}</p>
                  {row.marked && row.dateText.length > 0 ? (
                    <p className="text-xs text-[#1C3A2A]/60">{row.dateText}</p>
                  ) : null}
                  {row.marked && row.refText.length > 0 ? (
                    <p className="text-xs text-[#1C3A2A]/60">{row.refText}</p>
                  ) : null}
                  {!row.marked ? (
                    <p className="text-xs font-semibold text-[#1C3A2A]/60">{row.pendingText}</p>
                  ) : null}
                </div>
                {row.amount !== null ? (
                  <p
                    className={
                      row.marked
                        ? "text-sm font-bold text-[#24562F]"
                        : "text-sm font-semibold text-[#1C3A2A]/70"
                    }
                  >
                    {inr(row.amount)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {order.note ? (
        <div className="mt-4 rounded-2xl bg-[#F7F3E8] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/50">
            {t("s6_track_note")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#1C3A2A]/80">{order.note}</p>
        </div>
      ) : null}

      {status === "OUT_FOR_DELIVERY" && order.deliveryOtp ? (
        <div className="mt-4 rounded-xl bg-[#1C3A2A] px-4 py-3 text-center text-[#F7F3E8]">
          <p className="text-xs uppercase tracking-wide text-[#F7F3E8]/60">{t("s6_track_pin")}</p>
          <p className="text-3xl font-bold tracking-[0.4em]">{order.deliveryOtp}</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-[#1C3A2A]/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/50">
          {t("s6_track_timeline")}
        </p>
        <div className="mt-3 space-y-3">
          {order.events.length === 0 ? (
            <p className="text-sm text-[#1C3A2A]/50">{t("s6_track_no_events")}</p>
          ) : (
            [...order.events].reverse().map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#E4E0CE]/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="rounded-full bg-[#F7F3E8] px-3 py-0.5 text-xs font-semibold text-[#1C3A2A]">
                  {t(statusKeyOf(ev.status))}
                </span>
                <span className="text-xs text-[#1C3A2A]/60">{fmtTime(ev.createdAt)}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/40">
                  {t(actorKeyOf(ev.actorRole))}
                </span>
                {ev.note ? (
                  <span className="basis-full text-xs text-[#1C3A2A]/70">{ev.note}</span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {canConfirm ? (
        <div className="mt-6">
          <button
            type="button"
            disabled={busy}
            onClick={confirmReceipt}
            className="rounded-xl bg-[#2F6B3F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#255732] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("s6_track_confirming") : t("s6_track_confirm")}
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
          {t("s6_track_wa")}
        </a>
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}