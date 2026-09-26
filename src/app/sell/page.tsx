"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Fraunces, Karla } from "next/font/google";
import { LangPill, LangProvider, useLang } from "@/lib/i18n";
import { Btn, Card, ErrBox, Field, Loading, Pill, inputCls } from "@/app/shop/ui";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], variable: "--font-body" });

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

type ApplyUser = {
  name: string | null;
  phone: string;
  role: string;
  city: string | null;
  pincode: string | null;
};

type NurseryInfo = {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string;
};

type Phase =
  | { kind: "loading" }
  | { kind: "loadError" }
  | { kind: "guest" }
  | { kind: "admin" }
  | { kind: "status"; nursery: NurseryInfo }
  | { kind: "form"; user: ApplyUser }
  | { kind: "done" };

const SCOPES: { v: "RADIUS" | "CITY" | "STATE" | "INDIA"; key: string }[] = [
  { v: "RADIUS", key: "scope_radius" },
  { v: "CITY", key: "scope_city" },
  { v: "STATE", key: "scope_state" },
  { v: "INDIA", key: "scope_india" },
];

function nurseryTone(status: string): "leaf" | "amber" | "rose" | "cream" {
  if (status === "VERIFIED") {
    return "leaf";
  }
  if (status === "PENDING") {
    return "amber";
  }
  if (status === "REJECTED") {
    return "rose";
  }
  return "cream";
}

// ── Inline OTP login (no redirect — refetch who we are) ──────

function InlineLogin({ onVerified }: { onVerified: () => void }) {
  const { t } = useLang();
  const [step, setStep] = useState<1 | 2>(1);
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function sendOtp(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) {
      return;
    }
    setError("");

    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t("sell_err_phone"));
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91" + digits }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not send code");
      }

      setStep(2);
      setInfo(t("code_sent_info"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) {
      return;
    }
    setError("");

    if (!/^\d{6}$/.test(code)) {
      setError(t("sell_err_generic"));
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91" + digits, code: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not verify code");
      }

      // No redirect on /sell — just refetch who we are now.
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify code");
      setBusy(false);
    }
  }

  return (
    <div>
      {step === 1 ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <Field label={t("phone")} hint={t("phone_hint")}>
            <div className="flex">
              <span className="rounded-l-xl border border-r-0 border-[#1C3A2A]/20 bg-[#F7F3E8] px-3 py-2 text-sm text-[#1C3A2A]/70">
                +91
              </span>
              <input
                className="w-full rounded-r-xl border border-[#1C3A2A]/20 bg-white px-3 py-2 text-lg tracking-wide text-[#1C3A2A] outline-none focus:border-[#2F6B3F]"
                value={digits}
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </Field>
          <Btn type="submit" disabled={busy} className="w-full">
            {busy ? t("sending") : t("send_code")}
          </Btn>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          {info ? (
            <p className="rounded-xl bg-[#2F6B3F]/10 px-3 py-2 text-xs text-[#2F6B3F]">{info}</p>
          ) : null}

          <input
            className="w-full rounded-xl border border-[#1C3A2A]/20 bg-white px-3 py-2 text-center text-2xl tracking-[0.5em] text-[#1C3A2A] outline-none focus:border-[#2F6B3F]"
            value={code}
            inputMode="numeric"
            maxLength={6}
            aria-label={t("code_sent_info")}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />

          <Btn type="submit" disabled={busy} className="w-full">
            {busy ? t("verifying") : t("verify_continue")}
          </Btn>

          <button
            type="button"
            onClick={() => {
              setStep(1);
              setCode("");
              setInfo("");
            }}
            className="w-full text-sm text-[#1C3A2A]/60 underline"
          >
            {t("use_different")}
          </button>
        </form>
      )}

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}

// ── Nursery application form ─────────────────────────────────

function ApplyForm({ user, onApplied, onConflict }: { user: ApplyUser; onApplied: () => void; onConflict: () => void }) {
  const { t } = useLang();
  const [owner, setOwner] = useState(user.name ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(user.phone.startsWith("+91") ? user.phone.slice(3) : user.phone);
  const [city, setCity] = useState(user.city ?? "");
  const [area, setArea] = useState("");
  const [pin, setPin] = useState(user.pincode ?? "");
  const [gstin, setGstin] = useState("");
  const [scope, setScope] = useState<"RADIUS" | "CITY" | "STATE" | "INDIA">("CITY");
  const [km, setKm] = useState("");
  const [retail, setRetail] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [grow, setGrow] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function validate(): string {
    if (owner.trim().length < 2) {
      return t("sell_err_name");
    }
    if (name.trim().length < 2) {
      return t("sell_err_name");
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return t("sell_err_phone");
    }
    if (city.trim().length < 2) {
      return t("sell_err_city");
    }
    if (area.trim().length < 2) {
      return t("sell_err_area");
    }
    if (!/^[1-9]\d{5}$/.test(pin)) {
      return t("sell_err_pin");
    }
    if (!/^[0-9A-Za-z]{15}$/.test(gstin.trim())) {
      return t("sell_err_gstin");
    }
    if (scope === "RADIUS") {
      const n = Number(km);
      if (km === "" || !Number.isInteger(n) || n < 1 || n > 100) {
        return t("sell_err_km");
      }
    }
    if (!retail && !bulk) {
      return t("sell_err_sells");
    }
    if (grow.trim() !== "") {
      const n = Number(grow);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        return t("sell_err_generic");
      }
    }
    return "";
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) {
      return;
    }
    const err = validate();
    if (err !== "") {
      setError(err);
      return;
    }
    setError("");
    setBusy(true);

    try {
      const res = await fetch("/api/sell/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: owner.trim(),
          name: name.trim(),
          phone: "+91" + phone,
          city: city.trim(),
          area: area.trim(),
          pincode: pin.trim(),
          gstin: gstin.trim(),
          scope: scope,
          scopeKm: scope === "RADIUS" ? Number(km) : null,
          retailOk: retail,
          bulkOk: bulk,
          growArea: grow.trim() === "" ? null : grow.trim(),
        }),
      });

      if (res.ok) {
        onApplied();
        return;
      }
      if (res.status === 401) {
        setError(t("sell_err_state"));
        return;
      }
      if (res.status === 409) {
        // Already owns a nursery — reload; the status panel takes over.
        onConflict();
        return;
      }
      setError(t("sell_err_generic"));
    } catch {
      setError(t("sell_err_generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("full_name")}>
          <input className={inputCls} value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} />
        </Field>

        <Field label={t("nursery_name")}>
          <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label={t("nursery_phone")} hint={t("phone_hint")}>
          <div className="flex">
            <span className="rounded-l-xl border border-r-0 border-[#1C3A2A]/20 bg-[#F7F3E8] px-3 py-2 text-sm text-[#1C3A2A]/70">
              +91
            </span>
            <input
              className="w-full rounded-r-xl border border-[#1C3A2A]/20 bg-white px-3 py-2 text-sm text-[#1C3A2A] outline-none focus:border-[#2F6B3F] focus:ring-2 focus:ring-[#2F6B3F]/20"
              value={phone}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </Field>

        <Field label={t("city_label")}>
          <input className={inputCls} value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} />
        </Field>

        <Field label={t("area_label")}>
          <input className={inputCls} value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} />
        </Field>

        <Field label={t("pincode")}>
          <input
            className={inputCls}
            value={pin}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <Field label={t("gstin_label")}>
          <input
            className={inputCls}
            value={gstin}
            maxLength={15}
            placeholder="22AAAAA0000A1Z5"
            onChange={(e) => setGstin(e.target.value)}
          />
        </Field>

        <div>
          <span className="mb-2 block text-xs font-semibold tracking-wide text-[#1C3A2A]/60">{t("scope_label")}</span>
          <div className="space-y-2">
            {SCOPES.map((s) => (
              <label
                key={s.v}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#1C3A2A]/10 bg-white px-3 py-2.5"
              >
                <input
                  type="radio"
                  name="sell_scope"
                  value={s.v}
                  checked={scope === s.v}
                  onChange={() => setScope(s.v)}
                  className="accent-[#2F6B3F]"
                />
                <span className="text-sm text-[#20291D]">{t(s.key)}</span>
              </label>
            ))}
          </div>
        </div>

        {scope === "RADIUS" ? (
          <Field label={t("radius_km")}>
            <input
              className={inputCls}
              value={km}
              inputMode="numeric"
              maxLength={3}
              placeholder="15"
              onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        ) : null}

        <div>
          <span className="mb-2 block text-xs font-semibold tracking-wide text-[#1C3A2A]/60">{t("sells_label")}</span>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#1C3A2A]/10 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                checked={retail}
                onChange={(e) => setRetail(e.target.checked)}
                className="mt-0.5 accent-[#2F6B3F]"
              />
              <span className="text-sm text-[#20291D]">{t("sell_retail")}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#1C3A2A]/10 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                checked={bulk}
                onChange={(e) => setBulk(e.target.checked)}
                className="mt-0.5 accent-[#2F6B3F]"
              />
              <span className="text-sm text-[#20291D]">{t("sell_bulk")}</span>
            </label>
          </div>
        </div>

        <Field label={t("grow_area_label")}>
          <input
            className={inputCls}
            value={grow}
            inputMode="numeric"
            maxLength={3}
            placeholder="50"
            onChange={(e) => setGrow(e.target.value.replace(/\D/g, ""))}
          />
        </Field>

        {error ? <ErrBox>{error}</ErrBox> : null}

        <Btn type="submit" disabled={busy} size="lg" className="w-full">
          {busy ? t("sell_submitting") : t("sell_submit")}
        </Btn>
      </form>
    </Card>
  );
}

// ── Page shell ───────────────────────────────────────────────

function SellInner() {
  const { t } = useLang();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);

  async function load() {
    setPhase({ kind: "loading" });
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = meRes.ok ? await meRes.json() : null;
      const meUser = meData && meData.user ? (meData.user as ApplyUser) : null;

      if (!meUser) {
        setPhase({ kind: "guest" });
        return;
      }

      const role = String(meUser.role);
      if (role === "ADMIN" || role === "SUPER_ADMIN") {
        setPhase({ kind: "admin" });
        return;
      }

      const applyRes = await fetch("/api/sell/apply");
      if (applyRes.status === 401) {
        setPhase({ kind: "guest" });
        return;
      }
      if (applyRes.ok) {
        const applyData = await applyRes.json();
        const user = (applyData && applyData.user ? applyData.user : meUser) as ApplyUser;
        const nursery = applyData && applyData.nursery ? (applyData.nursery as NurseryInfo) : null;
        if (nursery) {
          setPhase({ kind: "status", nursery });
        } else {
          setPhase({ kind: "form", user });
        }
        return;
      }

      // Apply probe failed for a non-session reason — treat as no nursery on file.
      setPhase({ kind: "form", user: meUser });
    } catch {
      setPhase({ kind: "loadError" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function logout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors — refetch regardless
    }
    setLoggingOut(false);
    load();
  }

  return (
    <div className="min-h-screen bg-[#F7F3E8]" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <header className="sticky top-0 z-40 border-b border-[#E4E0CE] bg-[#F7F3E8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1C3A2A] text-lg" aria-hidden="true">
              🌱
            </span>
            <span className="text-xl font-semibold text-[#1C3A2A]" style={SERIF}>
              Tomavine
            </span>
          </Link>
          <LangPill />
        </div>
      </header>

      <main>
        {phase.kind === "loading" ? (
          <section className="py-24">
            <Loading />
          </section>
        ) : null}

        {phase.kind === "loadError" ? (
          <section className="mx-auto max-w-md px-4 py-20">
            <ErrBox>{t("load_error")}</ErrBox>
            <div className="mt-4 text-center">
              <Btn onClick={load}>{t("retry")}</Btn>
            </div>
          </section>
        ) : null}

        {phase.kind === "guest" ? (
          <>
            <section className="mx-auto max-w-6xl px-4 pb-6 pt-14 sm:pt-20">
              <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-[#20291D] sm:text-5xl" style={SERIF}>
                {t("sell_page_title")}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-[#66735F] sm:text-lg">{t("sell_page_s")}</p>
            </section>
            <section className="mx-auto max-w-sm px-4 pb-16">
              <Card>
                <h2 className="text-lg font-semibold text-[#1C3A2A]" style={SERIF}>
                  {t("sell_login_title")}
                </h2>
                <p className="mt-1 text-sm text-[#66735F]">{t("sell_login_s")}</p>
                <div className="mt-5">
                  <InlineLogin onVerified={load} />
                </div>
              </Card>
            </section>
          </>
        ) : null}

        {phase.kind === "form" ? (
          <section className="mx-auto max-w-2xl px-4 pb-16 pt-12">
            <h1 className="text-3xl font-semibold tracking-tight text-[#20291D]" style={SERIF}>
              {t("sell_form_title")}
            </h1>
            <p className="mt-3 text-sm text-[#66735F]">{t("sell_form_s")}</p>
            <ApplyForm user={phase.user} onApplied={() => setPhase({ kind: "done" })} onConflict={load} />
          </section>
        ) : null}

        {phase.kind === "done" ? (
          <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
            <h1 className="text-3xl font-semibold text-[#20291D]" style={SERIF}>
              {t("sell_done_t")}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-[#66735F]">{t("sell_done_s")}</p>
            <div className="mt-6 rounded-2xl border border-[#2F6B3F]/20 bg-[#EDF2E6] p-5 text-left">
              <p className="text-sm font-semibold text-[#24562F]">{t("sell_done_relogin")}</p>
              <p className="mt-2 text-sm text-[#66735F]">{t("sell_done_products")}</p>
            </div>
            <div className="mt-6">
              <Btn onClick={logout} disabled={loggingOut} size="lg">
                {t("sell_logout_btn")}
              </Btn>
            </div>
          </section>
        ) : null}

        {phase.kind === "status" ? (
          <section className="mx-auto max-w-xl px-4 pb-16 pt-12">
            <h1 className="text-3xl font-semibold tracking-tight text-[#20291D]" style={SERIF}>
              {t("sell_listed_t")}
            </h1>
            <Card className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[#20291D]" style={SERIF}>
                    {phase.nursery.name}
                  </p>
                  <p className="text-sm text-[#66735F]">{phase.nursery.city}</p>
                </div>
                <Pill tone={nurseryTone(phase.nursery.status)}>{phase.nursery.status}</Pill>
              </div>
              <p className="mt-4 text-sm text-[#66735F]">
                {phase.nursery.status === "VERIFIED"
                  ? t("sell_listed_verified")
                  : phase.nursery.status === "REJECTED"
                    ? t("sell_listed_rejected")
                    : t("sell_listed_pending")}
              </p>
              {phase.nursery.status === "VERIFIED" ? (
                <div className="mt-5">
                  <Btn href="/seller" size="lg">
                    {t("go_seller")}
                  </Btn>
                </div>
              ) : null}
            </Card>
          </section>
        ) : null}

        {phase.kind === "admin" ? (
          <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-[#20291D]" style={SERIF}>
              {t("sell_admin_t")}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-[#66735F]">{t("sell_admin_s")}</p>
            <div className="mt-6">
              <Btn href="/admin" size="lg">
                {t("admin")}
              </Btn>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="mt-10 bg-[#1C3A2A] px-4 py-10 text-center text-sm text-[#F7F3E8]/60">
        <p className="text-base font-semibold text-[#F7F3E8]" style={SERIF}>
          🌱 Tomavine
        </p>
        <p className="mt-1">Where growers meet gardens</p>
        <p className="mt-1 text-xs">Cash on delivery · From physically verified nurseries</p>
      </footer>
    </div>
  );
}

export default function SellPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <LangProvider>
        <SellInner />
      </LangProvider>
    </div>
  );
}