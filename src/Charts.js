import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  AreaChart, Area, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

const ACCENT = "#0D9488";
const currencyINR = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
});
const inr = (n) => currencyINR.format(Number(n || 0));

function lastSixMonthKeys() {
  const keys = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
  }
  return keys;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Charts() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState(null);
  // Detect dark mode from html class
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");

        const monthKeys = lastSixMonthKeys();

        const [rentRes, emiRes] = await Promise.all([
          supabase
            .from("rent_collections")
            .select("month_key, amount, received")
            .eq("user_id", user.id)
            .in("month_key", monthKeys),
          supabase
            .from("emi_payments")
            .select("month_key, paid, property_id")
            .eq("user_id", user.id)
            .in("month_key", monthKeys),
        ]);

        if (!alive) return;
        if (rentRes.error) throw rentRes.error;
        if (emiRes.error) throw emiRes.error;

        const { data: emiDetails } = await supabase
          .from("property_emi")
          .select("property_id, emi_amount")
          .eq("user_id", user.id);

        const emiAmountMap = Object.fromEntries(
          (emiDetails || []).map((e) => [e.property_id, Number(e.emi_amount)])
        );

        const rentByMonth = {};
        for (const row of rentRes.data || []) {
          if (!rentByMonth[row.month_key]) rentByMonth[row.month_key] = 0;
          if (row.received) rentByMonth[row.month_key] += Number(row.amount);
        }

        const emiByMonth = {};
        for (const row of emiRes.data || []) {
          if (!emiByMonth[row.month_key]) emiByMonth[row.month_key] = 0;
          if (row.paid) {
            emiByMonth[row.month_key] += emiAmountMap[row.property_id] || 0;
          }
        }

        const data = monthKeys.map((key) => {
          const [year, month] = key.split("-");
          return {
            month: MONTH_LABELS[parseInt(month, 10) - 1],
            rent: rentByMonth[key] || 0,
            emi: emiByMonth[key] || 0,
          };
        });

        setChartData(data);
      } catch (e) {
        if (!alive) return;
        setError(e.message);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const tickColor = dark ? "#94a3b8" : "#334155";
  const gridColor = dark ? "#334155" : "#E2E8F0";

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Charts</div>
        <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
          Live data — last 6 months of received rent vs paid EMI.
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-800">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white dark:bg-slate-800 p-6 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
        <div className="text-sm font-black text-slate-900 dark:text-white">Rental Income vs EMI Expense</div>
        <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {loading ? "Loading live data…" : "Showing actual received rent and paid EMIs."}
        </div>

        <div className="mt-5 h-[360px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400 dark:text-slate-500">
              Loading chart…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 12, fontWeight: 700 }} />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 12, fontWeight: 700 }}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: dark ? "#1e293b" : "#fff",
                    border: dark ? "1px solid #334155" : "1px solid #e2e8f0",
                    borderRadius: "12px",
                    color: dark ? "#f1f5f9" : "#0f172a",
                  }}
                  formatter={(value, name) => [inr(value), name === "rent" ? "Rent Received" : "EMI Paid"]}
                />
                <Legend wrapperStyle={{ color: tickColor }} />
                <Area type="monotone" dataKey="rent" name="Rent Received" stroke={ACCENT} fill="rgba(13,148,136,0.15)" strokeWidth={3} />
                <Area type="monotone" dataKey="emi" name="EMI Paid" stroke="#F59E0B" fill="rgba(245,158,11,0.12)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}