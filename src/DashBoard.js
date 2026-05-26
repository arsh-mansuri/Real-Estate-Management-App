import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  CreditCard, IndianRupee, Building2, TrendingUp,
  AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight
} from "lucide-react";

const currencyINR = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
});
const inr = (n) => currencyINR.format(Number(n || 0));

function Stat({ icon: Icon, label, value, tone = "slate", sub }) {
  const tones = {
    slate:   "bg-white dark:bg-slate-800 ring-slate-200 dark:ring-slate-700",
    teal:    "bg-white dark:bg-slate-800 ring-teal-200 dark:ring-teal-700",
    amber:   "bg-white dark:bg-slate-800 ring-amber-200 dark:ring-amber-700",
    emerald: "bg-white dark:bg-slate-800 ring-emerald-200 dark:ring-emerald-700",
    rose:    "bg-white dark:bg-slate-800 ring-rose-200 dark:ring-rose-700",
  };
  return (
    <div className={`rounded-3xl p-5 ring-1 ${tones[tone] || tones.slate} shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value}</div>
          {sub && <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{sub}</div>}
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-700 p-3 ring-1 ring-inset ring-slate-200 dark:ring-slate-600">
          <Icon size={18} className="text-slate-700 dark:text-slate-300" />
        </div>
      </div>
    </div>
  );
}

export default function DashBoard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary]  = useState(null);
  const [error, setError]      = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");

        const { data, error } = await supabase
          .from("dashboard_summary")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (!alive) return;
        if (error) throw error;
        setSummary(data);
      } catch (e) {
        if (!alive) return;
        setError(e.message);
        setSummary(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const net = summary ? Number(summary.net_per_month) : 0;
  const netTone = net >= 0 ? "emerald" : "rose";
  const NetIcon = net >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard</div>
        <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">Live portfolio overview.</div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Building2}
          label="Total Properties"
          value={loading ? "…" : String(summary?.total_properties ?? 0)}
        />
        <Stat
          icon={TrendingUp}
          label="Portfolio Value"
          value={loading ? "…" : inr(summary?.total_portfolio_value)}
          tone="teal"
        />
        <Stat
          icon={CreditCard}
          label="Monthly EMI (Sum)"
          value={loading ? "…" : inr(summary?.total_monthly_emi)}
          tone="amber"
          sub="Linked to EMI Tracker"
        />
        <Stat
          icon={IndianRupee}
          label="Monthly Rental Income"
          value={loading ? "…" : inr(summary?.total_monthly_rent)}
          tone="teal"
        />
      </div>

      {/* Net/Month tile */}
      <div className={`rounded-3xl p-5 ring-1 bg-white dark:bg-slate-800 ${netTone === "emerald" ? "ring-emerald-200 dark:ring-emerald-700" : "ring-rose-200 dark:ring-rose-700"} shadow-sm`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Net / Month</div>
            <div className={`mt-2 text-3xl font-black ${net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {loading ? "…" : inr(net)}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Rental Income − Monthly EMI
            </div>
          </div>
          <div className={`rounded-2xl p-4 ${net >= 0 ? "bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-200 dark:ring-emerald-700" : "bg-rose-50 dark:bg-rose-900/30 ring-rose-200 dark:ring-rose-700"} ring-1 ring-inset`}>
            <NetIcon size={22} className={net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-900 dark:text-white">Connection Status</div>
            <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              All tiles are reading live from Supabase via the dashboard_summary view.
            </div>
          </div>
          {summary ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-700">
              <CheckCircle2 size={14} /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-900/30 px-3 py-1 text-xs font-extrabold text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-200 dark:ring-amber-700">
              <AlertTriangle size={14} /> No data
            </span>
          )}
        </div>
      </div>
    </div>
  );
}