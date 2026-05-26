import React, { useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "./supabaseClient";
import { UserPlus, ArrowRight, ShieldCheck } from "lucide-react";

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

export default function CreateAccount() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  async function submit() {
    setErr("");
    setInfo("");

    if (pass.length < 8) return setErr("Password must be at least 8 characters.");
    if (pass !== confirm) return setErr("Passwords do not match.");

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) throw error;

      // If confirmations are OFF, you usually get a session immediately.
      if (data.session) {
        const { data: sess, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;
        if (!sess.session) throw new Error("Signup succeeded but session not available.");

        window.location.assign("/");
        return;
      }

      // If confirmations are ON, session is often null until email link is clicked.
      setInfo("Account created. Please check your email to confirm (if confirmations are enabled), then sign in.");
    } catch (e) {
      setErr(e?.message || "Sign-up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AuthCard title="Create account" subtitle="Start your PropVault workspace.">
        <div className="space-y-5">
          <Field label="Full name" value={fullName} onChange={setFullName} placeholder="e.g., Ananya Rao" autoComplete="name" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <Field label="Password" value={pass} onChange={setPass} placeholder="At least 8 characters" type="password" autoComplete="new-password" />
          <Field label="Confirm password" value={confirm} onChange={setConfirm} placeholder="Repeat password" type="password" autoComplete="new-password" />

          {err ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-700 ring-1 ring-inset ring-rose-200">
              {err}
            </div>
          ) : null}
          {info ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-200">
              {info}
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-teal-700 disabled:bg-teal-300"
          >
            <UserPlus size={16} />
            {busy ? "Creating…" : "Create account"}
            <ArrowRight size={16} />
          </button>

          <div className="text-center text-sm font-semibold text-slate-600">
            Already have an account?{" "}
            <Link to="/signin" className="text-teal-700 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </AuthCard>
    </div>
  );
}