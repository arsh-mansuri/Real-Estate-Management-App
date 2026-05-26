import React, { useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "./supabaseClient";
import { Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function ForgetPass() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  async function submit() {
    setErr("");
    setInfo("");
    setBusy(true);

    try {
      const redirectTo = `${window.location.origin}/signin`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setInfo("If an account exists for this email, a reset link has been sent.");
    } catch (e) {
      setErr(e?.message || "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
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
              <div className="text-2xl font-black text-slate-900">Reset password</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">We’ll email you a secure link.</div>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Email</div>
              <div className="rounded-2xl bg-white ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-teal-500">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {err ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-700 ring-1 ring-inset ring-rose-200">{err}</div>
            ) : null}
            {info ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-200">{info}</div>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-teal-700 disabled:bg-teal-300"
            >
              <Mail size={16} />
              {busy ? "Sending…" : "Send reset email"}
              <ArrowRight size={16} />
            </button>

            <div className="text-center text-sm font-semibold text-slate-600">
              <Link to="/signin" className="text-teal-700 hover:underline">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

