"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Btn, Card, Empty, ErrBox, Field, Loading, SectionTitle, inr, inputCls } from "../ui";
import { useLang } from "@/lib/i18n";
import type { ProductCard } from "@/lib/catalog";
import { nurseryFeatureOn } from "@/lib/nursery-features";
import { belowMoqLines, clearCart, computeTotals, loadCart, missingLines } from "@/lib/cart";
import type { CartLine } from "@/lib/cart";
import { DELIVERY_STATE_OPTIONS, HOME_STATE } from "@/lib/states";
import { LOCATION_LIST_ID, LocationDatalist } from "@/lib/location-options";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };
const STORE_KEY = "tv_orders_last";

type Me = { name: string | null; phone: string; city: string | null; pincode: string | null } | null;

type PlacedOrder = {
  code: string;
  amount: number;
  rzpOrderId?: string;
  payInitFailed?: boolean;
};

type PopupResult = "paid" | "dismissed" | "verify_failed" | "no_script";

// Mission F: cart-wide payment availability — every distinct nursery
// in the cart must accept the method (orders split per nursery, but one
// method pays for all of them). An empty cart allows everything.
function paymentAllowed(products: ProductCard[], key: "cod" | "online"): boolean {
  const accepted = new Map<string, boolean>();
  for (const p of products) {
    if (!accepted.has(p.nurseryId)) {
      accepted.set(p.nurseryId, nurseryFeatureOn(p.nurseryFeatures, key));
    }
  }
  for (const ok of accepted.values()) {
    if (!ok) {
      return false;
    }
  }
  return true;
}

// Mission S2 (scope C): the transport-cost note appears whenever the
// chosen state is not the nursery's home state. Informational only —
// no state is blocked, no automatic fee is ever added.
function TransportNote() {
  const { t } = useLang();
  return (
    <div className="mt-3 rounded-2xl border border-[#E39B2D]/40 bg-[#F7F3E8] p-3 text-sm font-semibold text-[#8a5a12]">
      🚛 {t("transport_note")}
    </div>
  );
}
function newIdemKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "k-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function toPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 10) {
    return digits;
  }
  return "";
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-[#66735F]">
      <span>{label}</span>
      <span className="font-semibold text-[#20291D]">{value}</span>
    </div>
  );
}

const MODE_ON = "flex w-full items-start gap-3 rounded-2xl border-2 border-[#2F6B3F] bg-[#EDF2E6] p-4 text-left";
const MODE_OFF = "flex w-full items-start gap-3 rounded-2xl border border-[#D6D2BC] bg-white p-4 text-left transition hover:border-[#2F6B3F]/50";
const DOT_ON = "mt-0.5 h-4 w-4 shrink-0 rounded-full border-[5px] border-[#2F6B3F]";
const DOT_OFF = "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-[#D6D2BC]";

export default function CheckoutPage() {
  const { t } = useLang();
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me>(null);
  const [meChecked, setMeChecked] = useState(false);
  const [mode, setMode] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [payMethod, setPayMethod] = useState<"online" | "cod">("cod");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [house, setHouse] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  // Mission S2 (scope C): delivery state dropdown — 7 covered states
  // + "Other". Default is the nursery's home state; picking anything
  // else shows the transport-cost note (no blocking, no auto fee).
  const [addrState, setAddrState] = useState<string>(HOME_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [payProblem, setPayProblem] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [placedCodes, setPlacedCodes] = useState<string[]>([]);
  const [idemKey] = useState<string>(newIdemKey);
  // Mission S3: live admin settings so the summary matches the charge.
  const [tiers, setTiers] = useState<{ minQty: number; pct: number }[] | null>(null);
  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.tiers)) {
          setTiers(data.tiers);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const current = loadCart();
    setLines(current);
    if (current.length === 0) {
      setLoading(false);
      return;
    }
    const ids = current.map((l) => l.productId).join(",");
    fetch(`/api/catalog/products?ids=${encodeURIComponent(ids)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (data && Array.isArray(data.products)) {
          setProducts(data.products);
          // Mission F: a nursery in the cart may not accept the default
          // payment method — slide to whichever one every nursery takes.
          const codOk = paymentAllowed(data.products as ProductCard[], "cod");
          const onlineOk = paymentAllowed(data.products as ProductCard[], "online");
          setPayMethod((prev) => {
            if (prev === "cod" && !codOk && onlineOk) {
              return "online";
            }
            if (prev === "online" && !onlineOk && codOk) {
              return "cod";
            }
            return prev;
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setMeChecked(true);
        if (data && data.user) {
          setMe(data.user);
          if (typeof data.user.name === "string") {
            setName(data.user.name);
          }
          const digits = toPhoneDigits(String(data.user.phone ?? ""));
          if (digits.length === 10) {
            setPhone(digits);
          }
          if (typeof data.user.city === "string") {
            setCity(data.user.city);
          }
          if (typeof data.user.pincode === "string") {
            setPincode(data.user.pincode);
          }
        }
      })
      .catch(() => {
        if (active) setMeChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load Razorpay checkout.js once (needed for the online payment popup).
  useEffect(() => {
    if (document.getElementById("rzp-checkout-script")) {
      return;
    }
    const s = document.createElement("script");
    s.id = "rzp-checkout-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const missing = missingLines(lines, products);
  // Mission S6-B: MOQ-enforced checkout (mirror of the cart page).
  const belowMoq = belowMoqLines(lines, products);
  const totals = computeTotals(lines, products, mode, payMethod, tiers === null ? undefined : { tiers: tiers });
  const codAllowed = paymentAllowed(products, "cod");
  const onlineAllowed = paymentAllowed(products, "online");
  const formValid =
    name.trim().length >= 2 &&
    /^[6-9]\d{9}$/.test(phone.trim()) &&
    house.trim().length >= 1 &&
    city.trim().length >= 2 &&
    /^[1-9]\d{5}$/.test(pincode.trim());

  async function verifyWithServer(
    resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  ): Promise<boolean> {
    try {
      const r = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rzpOrderId: resp.razorpay_order_id,
          rzpPaymentId: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
        }),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  function openPopup(order: PlacedOrder, keyId: string): Promise<PopupResult> {
    return new Promise((resolve) => {
      const Rzp = (window as unknown as { Razorpay?: new (o: unknown) => { open: () => void } }).Razorpay;
      if (!Rzp) {
        resolve("no_script");
        return;
      }
      const rzp = new Rzp({
        key: keyId,
        amount: order.amount * 100,
        currency: "INR",
        name: "Tomavine",
        description: order.code,
        order_id: order.rzpOrderId,
        prefill: { name: name.trim(), contact: phone.trim() },
        theme: { color: "#2F6B3F" },
        handler: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          verifyWithServer(resp).then((ok) => resolve(ok ? "paid" : "verify_failed"));
        },
        modal: {
          ondismiss: () => resolve("dismissed"),
        },
      });
      rzp.open();
    });
  }

  async function runOnlinePayment(orders: PlacedOrder[], keyId: string | null) {
    const payable = orders.filter((o) => o.rzpOrderId);
    const codes = orders.map((o) => o.code);
    const stopWith = (msg: string) => {
      setLines([]);
      setPlacedCodes(codes);
      setPayProblem(msg);
    };

    if (orders.some((o) => o.payInitFailed) || payable.length === 0) {
      stopWith(t("pay_init_failed"));
      return;
    }
    if (!keyId || typeof (window as unknown as { Razorpay?: unknown }).Razorpay !== "function") {
      stopWith(t("pay_init_failed"));
      return;
    }

    for (const order of payable) {
      const result = await openPopup(order, keyId);
      if (result === "dismissed") {
        stopWith(t("pay_window_closed"));
        return;
      }
      if (result === "verify_failed") {
        stopWith(t("pay_verify_failed"));
        return;
      }
      if (result === "no_script") {
        stopWith(t("pay_init_failed"));
        return;
      }
    }

    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ orders, duplicate: false, state: addrState }));
    router.push("/shop/success");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) {
      return;
    }
    if (!formValid || !accepted || missing.length > 0 || belowMoq.length > 0 || lines.length === 0) {
      setSubmitError(belowMoq.length > 0 ? t("s7_moq_checkout") : t("err_generic"));
      return;
    }
    // Mission F: payment switches — greyed buttons should have stopped
    // this, but a stale tab can still try; guard before the network.
    if ((payMethod === "cod" && !codAllowed) || (payMethod === "online" && !onlineAllowed)) {
      setSubmitError(t("err_pay_unavailable"));
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": idemKey },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
          mode: mode,
          address: {
            name: name.trim(),
            phone: "+91" + phone.trim(),
            house: house.trim(),
            street: street.trim() === "" ? undefined : street.trim(),
            city: city.trim(),
            pincode: pincode.trim(),
            state: addrState,
          },
          paymentMethod: payMethod === "cod" ? "cod" : "upi",
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        if (data && data.error === "out_of_stock" && data.item) {
          setSubmitError(t("err_stock", { item: data.item }));
        } else if (data && (data.error === "cod_unavailable" || data.error === "online_unavailable")) {
          setSubmitError(t("err_pay_unavailable"));
        } else if (data && (data.error === "unavailable" || data.error === "nursery_unavailable")) {
          setSubmitError(t("err_unavailable"));
        } else {
          setSubmitError(t("err_generic"));
        }
        return;
      }
      clearCart();
      const orders: PlacedOrder[] = data && Array.isArray(data.orders) ? data.orders : [];
      const duplicate = data ? data.duplicate === true : false;

      if (duplicate) {
        window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ orders: [], duplicate: true, state: addrState }));
        router.push("/shop/success");
        return;
      }
      if (payMethod === "online") {
        await runOnlinePayment(orders, (data && data.keyId) || null);
        return;
      }
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ orders, duplicate: false, state: addrState }));
      router.push("/shop/success");
    } catch {
      setSubmitError(t("err_generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !meChecked) {
    return <Loading />;
  }

  if (!me) {
    return (
      <Empty emoji="🔐" title={t("login_to_order")} action={<Btn href="/login">{t("login")}</Btn>} />
    );
  }

  if (payProblem) {
    return (
      <div>
        <SectionTitle>🧾 {t("checkout")}</SectionTitle>
        <Card>
          <p className="text-sm font-semibold text-[#20291D]">{payProblem}</p>
          {placedCodes.length > 0 ? (
            <p className="mt-2 text-sm text-[#66735F]">
              {t("order_codes")}: <span className="font-semibold text-[#20291D]">{placedCodes.join(", ")}</span>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn href="/shop/orders">{t("my_orders")}</Btn>
            <Btn href="/shop/c/plants" variant="outline">
              {t("browse")}
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <Empty
        emoji="🛒"
        title={t("cart_empty")}
        text={t("cart_empty_s")}
        action={<Btn href="/shop/c/plants">{t("browse")}</Btn>}
      />
    );
  }

  return (
    <div>
      <SectionTitle>🧾 {t("checkout")}</SectionTitle>
      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
              📚 {t("address")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={t("full_name")}>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </Field>
              <Field label={t("phone")} hint={t("phone_hint")}>
                <div className="flex">
                  <span className="grid place-items-center rounded-l-xl border border-r-0 border-[#1C3A2A]/15 bg-[#F7F3E8] px-3 text-sm font-bold text-[#1C3A2A]">
                    +91
                  </span>
                  <input
                    className={`${inputCls} rounded-l-none`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    required
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    autoComplete="tel-national"
                  />
                </div>
              </Field>
              <Field label={t("house")}>
                <input
                  className={inputCls}
                  value={house}
                  onChange={(e) => setHouse(e.target.value)}
                  required
                  autoComplete="address-line1"
                />
              </Field>
              <Field label={t("street")}>
                <input
                  className={inputCls}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  autoComplete="address-line2"
                />
              </Field>
              <Field label={t("city_label")}>
                <input
                  className={inputCls}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="address-level2"
                />
              </Field>
              <Field label={t("pincode")}>
                <input
                  className={inputCls}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  inputMode="numeric"
                  pattern="[1-9][0-9]{5}"
                  autoComplete="postal-code"
                  list={LOCATION_LIST_ID}
                />
                <LocationDatalist />
              </Field>
              <Field label={t("state_label")}>
                <select
                  className={inputCls}
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  autoComplete="address-level1"
                >
                  {DELIVERY_STATE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {addrState !== HOME_STATE ? <TransportNote /> : null}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
              🚚 {t("delivery")}
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setMode("DELIVERY")} className={mode === "DELIVERY" ? MODE_ON : MODE_OFF}>
                <span className={mode === "DELIVERY" ? DOT_ON : DOT_OFF} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#20291D]">{t("delivery_mode")}</span>
                </span>
              </button>
              <button type="button" onClick={() => setMode("PICKUP")} className={mode === "PICKUP" ? MODE_ON : MODE_OFF}>
                <span className={mode === "PICKUP" ? DOT_ON : DOT_OFF} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#20291D]">{t("pickup_mode")}</span>
                  <span className="block text-xs text-[#66735F]">{t("pickup_note")}</span>
                </span>
              </button>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
              💵 {t("payment")}
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPayMethod("online")}
                disabled={!onlineAllowed}
                className={`${payMethod === "online" ? MODE_ON : MODE_OFF} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={payMethod === "online" ? DOT_ON : DOT_OFF} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#20291D]">{t("pay_online")}</span>
                  <span className="block text-xs text-[#66735F]">{onlineAllowed ? t("pay_online_note") : t("pay_online_off")}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("cod")}
                disabled={!codAllowed}
                className={`${payMethod === "cod" ? MODE_ON : MODE_OFF} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={payMethod === "cod" ? DOT_ON : DOT_OFF} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#20291D]">{t("trust_cod")}</span>
                  <span className="block text-xs text-[#66735F]">{codAllowed ? t("cod_note") : t("pay_cod_off")}</span>
                </span>
              </button>
            </div>
          </Card>
        </div>

        <div>
          <Card className="lg:sticky lg:top-28">
            <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
              {t("order_summary")}
            </h2>
            {missing.length > 0 ? (
              <div className="mt-3">
                <ErrBox>
                  {t("err_unavailable")}{" "}
                  <Link href="/shop/cart" className="font-bold underline">
                    {t("cart_title")}
                  </Link>
                </ErrBox>
              </div>
            ) : null}
            {belowMoq.length > 0 ? (
              <div className="mt-3">
                <ErrBox>{t("s7_moq_checkout")}</ErrBox>
              </div>
            ) : null}
            {totals.orderCount > 1 ? (
              <p className="mb-3 mt-3 rounded-xl bg-[#EDF2E6] p-3 text-xs font-semibold text-[#24562F]">
                📦 {t("per_nursery", { n: totals.orderCount })}
              </p>
            ) : null}
            <div className="mt-3 space-y-1.5">
              {totals.groups.map((g) => (
                <div key={g.nurseryId} className="flex items-center justify-between gap-2 text-xs text-[#66735F]">
                  <span className="min-w-0 truncate">
                    {g.nurseryName} · {g.lines.length}
                  </span>
                  <span className="shrink-0 font-bold text-[#20291D]">{inr(g.total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5 border-t border-[#E4E0CE] pt-3">
              <SumRow label={t("subtotal")} value={inr(totals.sub)} />
              {totals.discount > 0 ? (
                <SumRow label={t("bulk_discount")} value={`−${inr(totals.discount)}`} />
              ) : null}
              <SumRow label={t("gst")} value={inr(totals.tax)} />
              <SumRow label={t("delivery")} value={inr(totals.delivery)} />
              {totals.cod > 0 ? <SumRow label={t("cod_fee")} value={inr(totals.cod)} /> : null}
            </div>
            <div className="mt-3 flex justify-between border-t border-dashed border-[#D6D2BC] pt-3 text-lg font-bold text-[#1C3A2A]">
              <span>{t("total")}</span>
              <span>{inr(totals.total)}</span>
            </div>
            <p className="mt-2 text-xs text-[#66735F]">{t("legal_checkout_note")}</p>
            {submitError ? (
              <div className="mt-3">
                <ErrBox>{submitError}</ErrBox>
              </div>
            ) : null}
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#1C3A2A]/10 bg-[#F7F3E8]/60 p-3 text-left">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 shrink-0 accent-[#2F6B3F]"
                aria-required="true"
              />
              <span className="text-xs text-[#66735F]">
                {t("legal_accept_label")}{" "}
                <Link href="/legal/refund" className="font-semibold text-[#2F6B3F] underline underline-offset-2">
                  {t("legal_accept_link")}
                </Link>
              </span>
            </label>
            <Btn type="submit" disabled={submitting || !formValid || missing.length > 0 || belowMoq.length > 0 || !accepted} size="lg" className="mt-4 w-full">
              {submitting ? t("placing") : t("place_order")}
            </Btn>
            <Btn href="/shop/cart" variant="ghost" size="sm" className="mt-2 w-full">
              ← {t("cart_title")}
            </Btn>
          </Card>
        </div>
      </form>
    </div>
  );
}