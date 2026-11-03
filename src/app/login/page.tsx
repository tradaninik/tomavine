"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type DemoCard = { email: string; role: string; note: string };

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [ownerMode, setOwnerMode] = useState(false);
  const [pass, setPass] = useState("");

  // Demo sign-in (mission DEMO-1): the tab appears only when the
  // demo route answers (DEMO_LOGIN=1 on the server); a 404 keeps
  // the whole surface hidden.
  const [demoMode, setDemoMode] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoCard[]>([]);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPass, setDemoPass] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/demo")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.users)) {
          setDemoUsers(data.users);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
      if (data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
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

  async function ownerLogin(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) {
      return;
    }
    setError("");
    if (!/^\d{10}$/.test(digits)) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    if (pass.length < 4) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91" + digits, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error === "not_enabled" ? "Owner sign-in is not configured." : "Wrong phone or password.");
      }
      let dest = "/";
      if (data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
        dest = "/admin";
      } else if (data.role === "SELLER") {
        dest = "/seller";
      }
      router.push(dest);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
      setBusy(false);
    }
  }

  async function demoSignIn(email: string, password: string) {
    if (demoBusy) {
      return;
    }
    setError("");
    if (!email || !password) {
      setError("Enter the demo email and password.");
      return;
    }
    setDemoBusy(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error === "not_enabled"
            ? "Demo sign-in is disabled on this deployment."
            : (data.error ?? "Could not sign in"),
        );
      }
      let dest = "/";
      if (data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
        dest = "/admin";
      } else if (data.role === "SELLER") {
        dest = "/seller";
      }
      router.push(dest);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
      setDemoBusy(false);
    }
  }

  async function demoLogin(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    await demoSignIn(demoEmail, demoPass);
  }

  function demoQuick(email: string) {
    void demoSignIn(email, "demo1234");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F3E8] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#1C3A2A]/10 bg-white p-8 shadow-lg">
        <p className="text-center text-3xl">🌱</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-[#1C3A2A]">Tomavine</h1>
        <p className="text-center text-sm text-[#1C3A2A]/60">Where growers meet gardens</p>

        {demoMode && demoUsers.length > 0 ? (
          <div className="mt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1C3A2A]/50">
              Demo accounts (password: demo1234)
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {demoUsers.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  disabled={demoBusy}
                  onClick={() => demoQuick(u.email)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#1C3A2A]/15 px-3 py-2 text-left transition hover:border-[#2F6B3F]/50 hover:bg-[#2F6B3F]/5 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#1C3A2A]">{u.email}</span>
                    <span className="block truncate text-xs text-[#1C3A2A]/60">{u.note}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#1C3A2A]/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1C3A2A]/70">
                    {u.role.replace(/_/g, " ").toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
            <form onSubmit={demoLogin} className="space-y-3 border-t border-[#1C3A2A]/10 pt-4">
              <label className="block text-sm font-medium text-[#1C3A2A]">
                Email
                <input
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 px-3 py-2 text-base"
                  type="email"
                  value={demoEmail}
                  autoComplete="username"
                  placeholder="buyer1@tomavine.dev"
                  onChange={(e) => setDemoEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-[#1C3A2A]">
                Password
                <input
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 px-3 py-2 text-base"
                  type="password"
                  value={demoPass}
                  autoComplete="current-password"
                  placeholder="demo1234"
                  onChange={(e) => setDemoPass(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={demoBusy}
                className="w-full rounded-xl bg-[#2F6B3F] px-4 py-3 font-semibold text-white transition hover:bg-[#255732] disabled:opacity-50"
              >
                {demoBusy ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        ) : ownerMode ? (
          <form onSubmit={ownerLogin} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-[#1C3A2A]">
              Mobile number
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 px-3 py-2 text-lg tracking-wide"
                value={digits}
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="block text-sm font-medium text-[#1C3A2A]">
              Password
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 px-3 py-2 text-lg"
                type="password"
                value={pass}
                autoComplete="current-password"
                onChange={(e) => setPass(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#2F6B3F] px-4 py-3 font-semibold text-white transition hover:bg-[#255732] disabled:opacity-50"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : step === 1 ? (
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

        {demoUsers.length > 0 && !ownerMode ? (
          <button
            type="button"
            onClick={() => {
              setDemoMode((v) => !v);
              setError("");
            }}
            className="mt-4 w-full text-center text-sm text-[#1C3A2A]/60 underline"
          >
            {demoMode ? "Use OTP sign-in instead" : "Demo accounts"}
          </button>
        ) : null}
        {!demoMode ? (
          <button
            type="button"
            onClick={() => {
              setOwnerMode((v) => !v);
              setError("");
            }}
            className="mt-4 w-full text-center text-sm text-[#1C3A2A]/60 underline"
          >
            {ownerMode ? "Use OTP sign-in instead" : "Owner sign-in"}
          </button>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <p className="mt-5 text-center text-xs leading-relaxed text-[#1C3A2A]/50">
          By continuing you agree to our{" "}
          <Link href="/legal/terms" className="text-[#2F6B3F] underline underline-offset-2">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-[#2F6B3F] underline underline-offset-2">
            Privacy Policy
          </Link>
          , and to receive service messages (OTP, order updates) on WhatsApp or SMS.
        </p>
      </div>
    </div>
  );
}