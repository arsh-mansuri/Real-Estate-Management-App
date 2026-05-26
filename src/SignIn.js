import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { supabase } from "./supabaseClient";
import { LogIn, ArrowRight, ShieldCheck } from "lucide-react";

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="h-[520px] w-full bg-gradient-to-b from-teal-500/15 via-cyan-500/10 to-transparent" />
      </div>

      <div className="w-full rounded-[34px] bg-white p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)] ring-1 ring-slate-200">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-slate-900 flex items-center justify-center">
            <ShieldCheck size={18} className="text-teal-300" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{title}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{subtitle}</div>
          </div>
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, autoComplete }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</div>
      <div className="rounded-2xl bg-white ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-teal-500">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function SignIn() {
  const location = useLocation();

  const redirectTo = useMemo(() => {
    return location.state?.from?.pathname || "/";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const { data, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;

      if (!data.session) {
        throw new Error(
          "No active session after sign-in. If email confirmation is enabled, confirm your email first (or disable confirmations for local dev)."
        );
      }

      // Most reliable for CRA: full navigation refresh so ProtectedRoute always sees the session.
      window.location.assign(redirectTo);
    } catch (e) {
      setErr(e?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AuthCard title="Sign in" subtitle="Access your PropVault workspace.">
        <div className="space-y-5">
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" autoComplete="current-password" />

          {err ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-700 ring-1 ring-inset ring-rose-200">
              {err}
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-teal-700 disabled:bg-teal-300"
          >
            <LogIn size={16} />
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={16} />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
            <Link to="/signup" className="text-teal-700 hover:underline" state={location.state}>
              Create account
            </Link>
            <Link to="/forget" className="text-slate-600 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
      </AuthCard>
    </div>
  );
}