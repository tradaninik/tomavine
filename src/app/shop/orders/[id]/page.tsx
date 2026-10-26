"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Btn, Card, CareChips, ErrBox, Loading, StarRow, catEmoji, formatDate, formatDateTime, inr, inputCls, statusTone, toast } from "../../ui";
import { displayName, useLang } from "@/lib/i18n";
import { readTrustMeta, formatPromisedDay, localeForLang } from "@/lib/trust";
import { careChips } from "@/lib/care";
import { HOME_STATE } from "@/lib/states";

const STATUS_KEYS: Record<string, string> = {
  PENDING: "st_pending",
  CONFIRMED: "st_confirmed",
  PREPARING: "st_preparing",
  OUT_FOR_DELIVERY: "st_out",
  DELIVERED: "st_delivered",
  CANCELLED: "st_cancelled",
  REJECTED: "st_rejected",
};

function StatusChip({ status }: { status: string }) {
  const { t } = useLang();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(status)}`}>
      {t(STATUS_KEYS[status] ?? status)}
    </span>
  );
}

type OrderItemRow = {
  id: string;
  productId: string;
  variantId: string | null;
  qty: number;
  unitPrice: number;
  nameSnap: string;
  vlabel: string | null;
  product: { nameEn: string; names: unknown; botanical: string | null; category: string };
};

type EventRow = {
  id: string;
  status: string;
  note: string | null;
  actorRole: string;
  createdAt: string;
};

type ReviewRow = {
  id: string;
  stars: number;
  text: string;
  reply: string | null;
  createdAt: string;
} | null;

type OrderDetail = {
  id: string;
  code: string;
  status: string;
  mode: string;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  createdAt: string;
  address: unknown;
  deliveryOtp: string | null;
  meta: unknown;
  nursery: { name: string; slug: string; city: string; phone: string };
  items: OrderItemRow[];
  events: EventRow[];
  review: ReviewRow;
  payment: { method: string | null; status: string } | null;
};

function addressLines(address: unknown): string[] {
  if (address === null || typeof address !== "object" || Array.isArray(address)) {
    return [];
  }
  const a = address as Record<string, unknown>;
  const line1 = typeof a.line1 === "string" ? a.line1.trim() : "";
  const house = typeof a.house === "string" ? a.house.trim() : "";
  const street = typeof a.street === "string" ? a.street.trim() : "";
  if (line1.length > 0) {
    return [line1];
  }
  const joined = [house, street].filter((s) => s.length > 0).join(", ");
  return joined.length > 0 ? [joined] : [];
}

function addressField(address: unknown, key: string): string {
  if (address === null || typeof address !== "object" || Array.isArray(address)) {
    return "";
  }
  const value = (address as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export default function OrderDetailPage() {
  const { lang, t } = useLang();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(false);
  const [careByProduct, setCareByProduct] = useState<Record<string, unknown>>({});

  const [pickProduct, setPickProduct] = useState("");
  const [pickStars, setPickStars] = useState(0);
  const [pickText, setPickText] = useState("");
  const [pickDelivery, setPickDelivery] = useState(0);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(() => {
    setOrder(null);
    setMissing(false);
    setError(false);
    fetch(`/api/customer/orders/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setMissing(true);
          return null;
        }
        return res.ok ? res.json() : Promise.reject(new Error("failed"));
      })
      .then((data) => {
        if (data && data.order) {
          setOrder(data.order as OrderDetail);
        }
      })
      .catch(() => {
        setError(true);
      });
  }, [id]);

  useEffect(() => {
    if (id.length > 0) {
      load();
    }
  }, [id, load]);

  useEffect(() => {
    if (order && order.items.length > 0) {
      setPickProduct((prev) => (prev.length > 0 ? prev : order.items[0].productId));
    }
  }, [order]);

  // Care guidance (v1): load current care data for the ordered products
  // from the public catalog. Products hidden since purchase fall back to
  // category defaults, which is fine for a care hint.
  useEffect(() => {
    if (!order || order.items.length === 0) {
      return;
    }
    const ids = Array.from(new Set(order.items.map((it) => it.productId))).join(",");
    let active = true;
    fetch(`/api/catalog/products?ids=${encodeURIComponent(ids)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data || !Array.isArray(data.products)) {
          return;
        }
        const map: Record<string, unknown> = {};
        for (const product of data.products) {
          map[product.id] = product.care;
        }
        setCareByProduct(map);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [order]);

  async function submitReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (reviewBusy) {
      return;
    }
    if (pickStars < 1 || pickProduct.length === 0 || pickText.trim().length < 3) {
      setReviewError(t("err_review"));
      return;
    }
    setReviewBusy(true);
    setReviewError(null);
    const payload: Record<string, unknown> = {
      orderId: id,
      productId: pickProduct,
      stars: pickStars,
      text: pickText.trim(),
    };
    if (order?.mode === "DELIVERY" && pickDelivery >= 1 && pickDelivery <= 5) {
      payload.deliveryRating = pickDelivery;
    }
    try {
      const res = await fetch("/api/customer/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        toast(t("review_thanks"));
        setPickStars(0);
        setPickText("");
        setPickDelivery(0);
        load();
      } else if (data && data.error === "not_delivered") {
        setReviewError(t("err_not_delivered"));
      } else if (data && data.error === "already_reviewed") {
        load();
      } else {
        setReviewError(t("err_review"));
      }
    } catch {
      setReviewError(t("err_review"));
    }
    setReviewBusy(false);
  }

  async function cancelOrder() {
    if (cancelBusy) {
      return;
    }
    if (!window.confirm(t("cancel_confirm"))) {
      return;
    }
    setCancelBusy(true);
    try {
      const res = await fetch(`/api/customer/orders/${id}/cancel`, { method: "POST" });
      if (res.ok) {
        toast(t("cancel_ok"));
      } else {
        toast(t("err_cancel"));
      }
      load();
    } catch {
      toast(t("err_cancel"));
    }
    setCancelBusy(false);
  }

  if (id.length === 0 || error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrBox>{t("load_error")}</ErrBox>
        <div className="mt-4">
          <Btn onClick={load}>{t("retry")}</Btn>
        </div>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Emptyish title={t("order_missing")} />
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Loading />
      </div>
    );
  }

  const lines = addressLines(order.address);
  const aName = addressField(order.address, "name");
  const aPhone = addressField(order.address, "phone");
  const aCity = addressField(order.address, "city");
  const aPin = addressField(order.address, "pincode");
  // Mission S2 (scope C): state on the address JSON — shown with the
  // city and, when it is not the nursery's home state, the transport
  // note rides on the order confirmation (informational only).
  const aState = addressField(order.address, "state");
  const outsideHomeState = aState.length > 0 && aState !== HOME_STATE;
  const trust = readTrustMeta(order.meta);
  const codFee =
    order.payment?.method === "cod"
      ? Math.max(0, order.total - order.subtotal - order.tax - order.deliveryFee + order.discount)
      : 0;
  const showPin = order.deliveryOtp !== null && order.deliveryOtp.length > 0 && order.status !== "DELIVERED" && order.status !== "CANCELLED" && order.status !== "REJECTED";
  const reviewChoices = order.items.filter((it, i, arr) => arr.findIndex((x) => x.productId === it.productId) === i);
  const eventsDesc = [...order.events].reverse();
  const careRows = order.items.filter(
    (it, i, arr) =>
      arr.findIndex((x) => x.productId === it.productId) === i &&
      careChips(careByProduct[it.productId] ?? null, it.product.category).length > 0
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/shop/orders" className="text-sm font-bold text-[#2F6B3F] hover:underline">
        {t("back_to_orders")}
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#1C3A2A] sm:text-3xl" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
            {order.code}
          </h1>
          <p className="mt-1 text-sm text-[#66735F]">
            {t("placed_on", { d: formatDate(order.createdAt) })}{" "}
            <Link href={`/shop/nursery/${order.nursery.slug}`} className="font-semibold text-[#2F6B3F] hover:underline">
              {order.nursery.name} · {order.nursery.city}
            </Link>
          </p>
          {order.mode === "DELIVERY" && trust.promisedDate && order.status !== "DELIVERED" && order.status !== "CANCELLED" && order.status !== "REJECTED" ? (
            <p className="mt-1 text-sm font-semibold text-[#24562F]">
              🗓 {t("promised_by", { d: formatPromisedDay(trust.promisedDate, localeForLang(lang)) })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={order.status} />
          <span className="rounded-full bg-[#EDF2E6] px-2.5 py-0.5 text-xs font-semibold text-[#24562F]">
            {order.mode === "PICKUP" ? t("pickup_mode") : t("delivery_mode")}
          </span>
          {order.status === "DELIVERED" && trust.onTime === true ? (
            <span className="rounded-full bg-[#2F6B3F]/10 px-2.5 py-0.5 text-xs font-semibold text-[#2F6B3F]">{t("ontime_badge")}</span>
          ) : null}
          {order.status === "DELIVERED" && trust.onTime === false ? (
            <span className="rounded-full bg-[#C14E2A]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C14E2A]">{t("late_badge")}</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        {order.status === "PENDING" || order.status === "CONFIRMED" ? (
          <Card className="border-[#C14E2A]/25 bg-[#F7F3E8]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-sm text-[#66735F]">{t("cancel_note")}</p>
              <Btn variant="danger" onClick={cancelOrder} disabled={cancelBusy}>
                {t("cancel_order")}
              </Btn>
            </div>
          </Card>
        ) : null}

        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{t("items")}</p>
          <div className="mt-3 space-y-3">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EDF2E6] text-xl" aria-hidden="true">
                  {catEmoji(it.product.category)}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/shop/product/${it.productId}`} className="block truncate text-sm font-semibold text-[#20291D] hover:underline">
                    {displayName(it.product.names, lang, it.nameSnap)}
                  </Link>
                  <p className="truncate text-xs text-[#66735F]">
                    {it.vlabel ? `${it.vlabel} · ` : ""}₹{it.unitPrice} × {it.qty}
                  </p>
                </div>
                <span className="text-sm font-bold text-[#1C3A2A]">{inr(it.unitPrice * it.qty)}</span>
              </div>
            ))}
          </div>
        </Card>

        {careRows.length > 0 ? (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">🌱 {t("care_title")}</p>
            <div className="mt-3 space-y-3">
              {careRows.map((it) => (
                <div key={it.id}>
                  <p className="text-sm font-semibold text-[#20291D]">{displayName(it.product.names, lang, it.nameSnap)}</p>
                  <CareChips care={careByProduct[it.productId] ?? null} category={it.product.category} className="mt-1" />
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{t("order_summary")}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-[#66735F]">
              <span>{t("subtotal")}</span>
              <span className="font-semibold text-[#1C3A2A]">{inr(order.subtotal)}</span>
            </div>
            {order.discount > 0 ? (
              <div className="flex justify-between text-[#66735F]">
                <span>{t("discount")}</span>
                <span className="font-semibold text-[#24562F]">−{inr(order.discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-[#66735F]">
              <span>{t("gst")}</span>
              <span className="font-semibold text-[#1C3A2A]">{inr(order.tax)}</span>
            </div>
            <div className="flex justify-between text-[#66735F]">
              <span>{t("delivery")}</span>
              <span className="font-semibold text-[#1C3A2A]">{inr(order.deliveryFee)}</span>
            </div>
            {codFee > 0 ? (
              <div className="flex justify-between text-[#66735F]">
                <span>{t("cod_fee")}</span>
                <span className="font-semibold text-[#1C3A2A]">{inr(codFee)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-[#E4E0CE] pt-2 text-base">
              <span className="font-bold text-[#1C3A2A]">{t("total")}</span>
              <span className="font-bold text-[#1C3A2A]">{inr(order.total)}</span>
            </div>
          </div>
        </Card>

        {order.mode === "DELIVERY" ? (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{t("address")}</p>
            <div className="mt-2 text-sm text-[#66735F]">
              {aName ? <p className="font-semibold text-[#1C3A2A]">{aName}</p> : null}
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {aCity || aState || aPin ? (
                <p>
                  {[[aCity, aState].filter((s) => s.length > 0).join(", "), aPin]
                    .filter((s) => s.length > 0)
                    .join(" – ")}
                </p>
              ) : null}
              {aPhone ? <p className="mt-1">📞 {aPhone}</p> : null}
            </div>
            {outsideHomeState ? (
              <div className="mt-3 rounded-2xl border border-[#E39B2D]/40 bg-[#F7F3E8] p-3 text-sm font-semibold text-[#8a5a12]">
                🚛 {t("transport_note")}
              </div>
            ) : null}
          </Card>
        ) : null}

        {showPin ? (
          <Card className="border-[#E39B2D]/40 bg-[#F7F3E8]">
            <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">🔐 {t("delivery_pin")}</p>
            <p className="mt-2 text-3xl font-bold tracking-[0.4em] text-[#1C3A2A]">{order.deliveryOtp}</p>
            <p className="mt-2 text-xs text-[#66735F]">{t("delivery_pin_s")}</p>
          </Card>
        ) : null}

        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{t("timeline")}</p>
          <div className="mt-3 space-y-4">
            {eventsDesc.length === 0 ? (
              <p className="text-sm text-[#66735F]">{t("st_pending")}</p>
            ) : (
              eventsDesc.map((ev) => (
                <div key={ev.id} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#2F6B3F]" />
                    <span className="mt-1 w-px flex-1 bg-[#E4E0CE]" />
                  </div>
                  <div className="pb-1">
                    <StatusChip status={ev.status} />
                    <p className="mt-1 text-xs text-[#8E9A84]">{formatDateTime(ev.createdAt)}</p>
                    {ev.note ? <p className="mt-1 text-sm text-[#66735F]">{ev.note}</p> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {order.review ? (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{t("review_text")}</p>
            <div className="mt-2">
              <StarRow value={order.review.stars} />
              <p className="mt-2 text-sm text-[#20291D]">{order.review.text}</p>
              <p className="mt-1 text-xs text-[#8E9A84]">{formatDate(order.review.createdAt)}</p>
              {order.mode === "DELIVERY" && trust.deliveryRating ? (
                <p className="mt-2 text-sm font-semibold text-[#1C3A2A]">
                  🚚 {t("delivery_rated", { n: trust.deliveryRating })}
                </p>
              ) : null}
              {order.review.reply ? (
                <div className="mt-3 rounded-2xl bg-[#EDF2E6] p-3">
                  <p className="text-xs font-bold text-[#24562F]">{t("nursery_reply")}</p>
                  <p className="mt-1 text-sm text-[#66735F]">{order.review.reply}</p>
                </div>
              ) : null}
            </div>
          </Card>
        ) : order.status === "DELIVERED" ? (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{t("review_title")}</p>
            <form onSubmit={submitReview} className="mt-3 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wide text-[#1C3A2A]/60">{t("review_pick")}</label>
                <select value={pickProduct} onChange={(e) => setPickProduct(e.target.value)} className={inputCls}>
                  {reviewChoices.map((it) => (
                    <option key={it.productId} value={it.productId}>
                      {displayName(it.product.names, lang, it.nameSnap)}
                      {it.vlabel ? ` · ${it.vlabel}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold tracking-wide text-[#1C3A2A]/60">{t("review_text")}</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-label={`${s} / 5`}
                      onClick={() => setPickStars(s)}
                      className="text-2xl leading-none transition hover:scale-110"
                    >
                      <span className={s <= pickStars ? "text-[#E39B2D]" : "text-[#D6D2BC]"}>★</span>
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-semibold text-[#1C3A2A]">{pickStars > 0 ? `${pickStars}/5` : t("tap_to_rate")}</span>
                </div>
              </div>
              {order.mode === "DELIVERY" ? (
                <div>
                  <span className="mb-1 block text-xs font-semibold tracking-wide text-[#1C3A2A]/60">{t("delivery_rate_q")}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-label={`${s} / 5`}
                        onClick={() => setPickDelivery(s)}
                        className="text-2xl leading-none transition hover:scale-110"
                      >
                        <span className={s <= pickDelivery ? "text-[#E39B2D]" : "text-[#D6D2BC]"}>★</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-[#8E9A84]">{t("delivery_rate_hint")}</p>
                </div>
              ) : null}
              <textarea
                value={pickText}
                onChange={(e) => setPickText(e.target.value)}
                rows={3}
                maxLength={1000}
                className={inputCls}
              />
              {reviewError ? <ErrBox>{reviewError}</ErrBox> : null}
              <Btn type="submit" disabled={reviewBusy}>
                {t("review_submit")}
              </Btn>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Emptyish({ title }: { title: string }) {
  const { t } = useLang();
  return (
    <div className="rounded-2xl border border-dashed border-[#1C3A2A]/20 bg-white/60 p-10 text-center">
      <p className="text-4xl" aria-hidden="true">
        📦
      </p>
      <h2 className="mt-3 text-lg font-semibold text-[#1C3A2A]">{title}</h2>
      <div className="mt-5">
        <Btn href="/shop/orders">{t("back_to_orders")}</Btn>
      </div>
    </div>
  );
}