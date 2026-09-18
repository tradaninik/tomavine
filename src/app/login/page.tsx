"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();

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

    if (!/^\d{10}$/.test(digits)) {
      setError("Enter your 10-digit mobile number.");
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
      setInfo("Code sent. Until WhatsApp is configured, you can read it in your dev terminal — look for the [WA:skipped] line.");
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
      setError("Enter the 6-digit code.");
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

      let dest = "/";
      if (data.role === "ADMIN") {
        dest = "/admin";
      } else if (data.role === "SELLER") {
        dest = "/seller";
      }

      router.push(dest);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify code");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F3E8] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#1C3A2A]/10 bg-white p-8 shadow-lg">
        <p className="text-center text-3xl">🌱</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-[#1C3A2A]">Tomavine</h1>
        <p className="text-center text-sm text-[#1C3A2A]/60">Where growers meet gardens</p>

        {step === 1 ? (
          <form onSubmit={sendOtp} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-[#1C3A2A]">
              Mobile number
              <div className="mt-1 flex">
                <span className="rounded-l-lg border border-r-0 border-[#1C3A2A]/20 bg-[#F7F3E8] px-3 py-2 text-sm text-[#1C3A2A]/70">
                  +91
                </span>
                <input
                  className="w-full rounded-r-lg border border-[#1C3A2A]/20 px-3 py-2 text-lg tracking-wide"
                  value={digits}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#2F6B3F] px-4 py-3 font-semibold text-white transition hover:bg-[#255732] disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            {info ? (
              <p className="rounded-xl bg-[#2F6B3F]/10 px-3 py-2 text-xs text-[#2F6B3F]">{info}</p>
            ) : null}

            <label className="block text-sm font-medium text-[#1C3A2A]">
              6-digit code
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 px-3 py-2 text-center text-2xl tracking-[0.5em]"
                value={code}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#2F6B3F] px-4 py-3 font-semibold text-white transition hover:bg-[#255732] disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & continue"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setInfo("");
              }}
              className="w-full text-sm text-[#1C3A2A]/60 underline"
            >
              Use a different number
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}