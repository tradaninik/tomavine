"use client";

// Mission S3 (scope C): the multi-item RFQ form. No login - buyers
// with project lists send name/phone/city/state/pincode + item rows
// (catalog product OR free-text name + qty). Anti-spam: strict client
// checks + a hidden honeypot; the server re-validates everything.

import { useState } from "react";
import type { FormEvent } from "react";
import { Btn, Card, ErrBox, Field, inputCls } from "@/app/shop/ui";
import { displayName, useLang } from "@/lib/i18n";
import { DELIVERY_STATE_OPTIONS, HOME_STATE } from "@/lib/states";
import { whatsappLink, type PublicSettings } from "@/lib/settings-shared";

type PickProduct = { id: string; nameEn: string; names: Record<string, string> | null };
type Row = { productId: string; name: string; qty: string };

export function BulkRfqForm({ products, settings }: { products: PickProduct[]; settings: PublicSettings | null }) {
  const { lang, t } = useLang();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<string>(HOME_STATE);
  const [pincode, setPincode] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState(""); // honeypot - humans never see it
  const [rows, setRows] = useState<Row[]>([{ productId: "", name: "", qty: "10" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const phoneOk = /^(\+91)?[6-9]\d{9}$/.test(phone.trim());
  const pinOk = /^[1-9]\d{5}$/.test(pincode.trim());
  const rowsFilled = rows.some((r) => r.productId !== "" || r.name.trim().length >= 1);
  const formValid = name.trim().length >= 2 && phoneOk && city.trim().length >= 2 && pinOk && rowsFilled;

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, ix) => (ix === i ? { ...r, ...patch } : r)));
  }

  function filledRows(): Row[] {
    return rows.filter((r) => r.productId !== "" || r.name.trim().length >= 1);
  }

  function rowLabel(r: Row): string {
    const p = products.find((x) => x.id === r.productId);
    return p ? displayName(p.names, lang, p.nameEn) : r.name.trim();
  }

  function rowQty(r: Row): number {
    return Math.max(1, Math.floor(Number(r.qty) || 1));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) {
      return;
    }
    setError("");
    const items = filledRows().map((r) => ({
      productId: r.productId === "" ? undefined : r.productId,
      name: rowLabel(r),
      qty: rowQty(r),
    }));
    if (items.length === 0) {
      setError(t("s3_err"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/customer/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: hp,
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim(),
          state: state,
          pincode: pincode.trim(),
          neededBy: neededBy === "" ? undefined : neededBy,
          notes: notes.trim() === "" ? undefined : notes.trim(),
          items: items,
        }),
      });
      if (!res.ok) {
        throw new Error("failed");
      }
      setDone(true);
    } catch {
      setError(t("s3_err"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const summary = filledRows().map((r) => rowLabel(r) + " x " + rowQty(r)).join(", ");
    return (
      <Card>
        <p className="text-base font-bold text-[#24562F]">{t("s3_success")}</p>
        {settings !== null && settings.whatsappNumber ? (
          <a
            href={whatsappLink(
              settings.whatsappNumber,
              "Hello! I just sent a bulk enquiry on Tomavine: " + summary + ". Delivery city: " + city.trim() + "."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2F6B3F] px-5 py-3 text-sm font-bold text-white hover:bg-[#24562F]"
          >
            {t("s3_success_wa")}
          </a>
        ) : null}
        <div className="mt-4">
          <Btn href="/" variant="outline" size="sm">
            &larr; {t("browse")}
          </Btn>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="text"
        name="website"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("s3_name")}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </Field>
          <Field label={t("s3_phone")} hint={t("phone_hint")}>
            <input
              className={inputCls}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label={t("s3_city")}>
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required maxLength={60} />
          </Field>
          <Field label={t("state_label")}>
            <select className={inputCls} value={state} onChange={(e) => setState(e.target.value)}>
              {DELIVERY_STATE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("pincode")}>
            <input
              className={inputCls}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label={t("needed_by")}>
            <input className={inputCls} type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-[#1C3A2A]">{t("s3_items")}</h2>
        <div className="mt-3 space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem_auto]">
              <select
                aria-label={t("s3_item_product")}
                className={inputCls}
                value={r.productId}
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  setRow(i, { productId: e.target.value, name: p ? displayName(p.names, lang, p.nameEn) : "" });
                }}
              >
                <option value="">{t("s3_item_product")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p.names, lang, p.nameEn)}
                  </option>
                ))}
              </select>
              <input
                className={inputCls}
                placeholder={t("s3_item_or")}
                maxLength={120}
                value={r.name}
                disabled={r.productId !== ""}
                onChange={(e) => setRow(i, { name: e.target.value })}
              />
              <input
                className={inputCls}
                aria-label={t("qty")}
                type="number"
                min={1}
                value={r.qty}
                onChange={(e) => setRow(i, { qty: e.target.value.replace(/\D/g, "") })}
              />
              <button
                type="button"
                disabled={rows.length <= 1}
                onClick={() => setRows((rs) => rs.filter((_, ix) => ix !== i))}
                className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={rows.length >= 50}
          onClick={() => setRows((rs) => [...rs, { productId: "", name: "", qty: "10" }])}
          className="mt-3 rounded-xl border-2 border-[#2F6B3F] px-4 py-2 text-sm font-bold text-[#2F6B3F] hover:bg-[#EDF2E6] disabled:opacity-40"
        >
          + {t("s3_add_item")}
        </button>
      </Card>

      <Card>
        <Field label={t("notes_opt")}>
          <textarea className={inputCls} rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error ? (
          <div className="mt-3">
            <ErrBox>{error}</ErrBox>
          </div>
        ) : null}
        <div className="mt-4">
          <Btn type="submit" disabled={busy || !formValid} size="lg" className="w-full">
            {busy ? t("s3_sending") : t("s3_submit")}
          </Btn>
        </div>
      </Card>
    </form>
  );
}