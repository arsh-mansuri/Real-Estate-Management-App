import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Home,
  CreditCard,
  IndianRupee,
  FileText,
  BadgePercent,
  Bell,
  Plus,
  X,
  Menu,
  Building2,
  MapPin,
  Search,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Calendar,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import { supabase } from "./supabaseClient";
import { useProperties } from "./hooks/useProperties";
import ConfirmDeletePropertyModal from "./components/ConfirmDeletePropertyModal";

const NAVY = "#0F172A";
const ACCENT = "#0D9488";

const currencyINR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
function inr(n) {
  const num = Number(n || 0);
  return currencyINR.format(Number.isFinite(num) ? num : 0);
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function Badge({ tone = "slate", children }) {
  const tones = {
    green: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-700",
    red: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-700",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-700",
    slate: "bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-600",
    teal: "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 ring-teal-200 dark:ring-teal-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Modal({ title, open, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-4 sm:px-6 py-4">
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900 dark:text-white truncate">{title}</div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Saved to Supabase</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 hover:bg-slate-50"
              aria-label="Close"
            >
              <X size={18} className="text-slate-700 dark:text-slate-300" />
            </button>
          </div>
          <div className="max-h-[min(78vh,calc(100vh-140px))] overflow-auto px-4 sm:px-6 py-5">{children}</div>
          {footer ? <div className="border-t border-slate-100 dark:border-slate-700 px-4 sm:px-6 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{label}</div>
      <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">{children}</div>
    </div>
  );
}

const SECTIONS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "properties", label: "My Properties", icon: Home },
  { key: "emi", label: "EMI Tracker", icon: CreditCard },
  { key: "rental", label: "Rental Income", icon: IndianRupee },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "advisor", label: "Loan Advisor", icon: BadgePercent },
];

// ─── CURRENT MONTH KEY helper ─────────────────────────────────────────────────
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── DASHBOARD SUMMARY hook (single source of truth for all tiles) ────────────
function useDashboardSummary() {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const refresh = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("dashboard_summary")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      setSummary(data);
    } catch (e) {
      console.error("dashboard_summary fetch:", e.message);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { summary, loadingSummary, refreshSummary: refresh };
}

// ─── SUPABASE EMI hook (replaces localStorage useEmiStorage) ─────────────────
// Reads from property_emi table joined with properties for the property name.
function useSupabaseEmis(onMutate) {
  const [emis, setEmis] = useState([]);
  const [loadingEmis, setLoadingEmis] = useState(true);

  const refresh = useCallback(async () => {
    setLoadingEmis(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("property_emi")
        .select(`
          property_id,
          lender,
          loan_amount,
          interest_rate,
          emi_amount,
          loan_start_date,
          loan_tenure_months,
          remaining_tenure_months,
          emi_due_day,
          properties ( id, title, address )
        `)
        .eq("user_id", user.id);
      if (error) throw error;
      setEmis(data || []);
    } catch (e) {
      console.error("property_emi fetch:", e.message);
      setEmis([]);
    } finally {
      setLoadingEmis(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function addEmi(record) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    const { error } = await supabase.from("property_emi").upsert({
      property_id: record.propertyId,
      user_id: user.id,
      lender: record.lender || null,
      loan_amount: Number(record.principal),
      interest_rate: Number(record.rate),
      emi_amount: Number(record.emiAmount),
      loan_start_date: record.startDate || null,
      loan_tenure_months: Number(record.tenure),
      remaining_tenure_months: Number(record.tenure),
      emi_due_day: Number(record.emiDueDay || 5),
    }, { onConflict: "property_id" });
    if (error) { console.error("property_emi insert:", error.message); return { ok: false }; }
    await refresh();
    onMutate?.();
    return { ok: true };
  }

  async function removeEmi(propertyId) {
    const { error } = await supabase.from("property_emi").delete().eq("property_id", propertyId);
    if (error) { console.error("property_emi delete:", error.message); return; }
    await refresh();
    onMutate?.();
  }

  return { emis, loadingEmis, addEmi, removeEmi, refreshEmis: refresh };
}

// ─── SUPABASE RECEIPTS hook (replaces localStorage useReceiptStorage) ─────────
// Reads from rent_collections table.
function useSupabaseReceipts(onMutate) {
  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  const refresh = useCallback(async () => {
    setLoadingReceipts(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("rent_collections")
        .select("*")
        .eq("user_id", user.id)
        .order("month_key", { ascending: false });
      if (error) throw error;
      setReceipts(data || []);
    } catch (e) {
      console.error("rent_collections fetch:", e.message);
      setReceipts([]);
    } finally {
      setLoadingReceipts(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function addReceipt(record) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    const { error } = await supabase.from("rent_collections").upsert({
      user_id: user.id,
      property_id: record.propertyId,
      month_key: record.month,
      amount: Number(record.amount),
      received: record.status === "Received",
      received_on: record.status === "Received" ? new Date().toISOString() : null,
    }, { onConflict: "property_id,month_key" });
    if (error) { console.error("rent_collections insert:", error.message); return { ok: false }; }
    await refresh();
    onMutate?.();
    return { ok: true };
  }

  async function removeReceipt(id) {
    const { error } = await supabase.from("rent_collections").delete().eq("id", id);
    if (error) { console.error("rent_collections delete:", error.message); return; }
    await refresh();
    onMutate?.();
  }

  return { receipts, loadingReceipts, addReceipt, removeReceipt, refreshReceipts: refresh };
}

// ─── EMI TRACKER SECTION ──────────────────────────────────────────────────────
function calcEMI(principal, annualRate, tenureMonths) {
  const P = Number(principal);
  const r = Number(annualRate) / 12 / 100;
  const n = Number(tenureMonths);
  if (!P || !n) return 0;
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function emiProgress(loanAmount, annualRate, tenureMonths, startDate) {
  if (!startDate) return { paid: 0, remaining: Number(tenureMonths), paidAmount: 0, remainingAmount: 0 };
  const start = new Date(startDate);
  const now = new Date();
  const monthsPaid = Math.max(
    0,
    Math.min(
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
      Number(tenureMonths)
    )
  );
  const emi = calcEMI(loanAmount, annualRate, tenureMonths);
  return {
    paid: monthsPaid,
    remaining: Number(tenureMonths) - monthsPaid,
    paidAmount: emi * monthsPaid,
    remainingAmount: emi * (Number(tenureMonths) - monthsPaid),
  };
}

function EMITrackerSection({ properties, onMutate }) {
  const { emis, loadingEmis, addEmi, removeEmi, refreshEmis } = useSupabaseEmis(onMutate);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    propertyId: "", principal: "", rate: "", tenure: "",
    startDate: "", emiAmount: "", lender: "", emiDueDay: "5",
  });
  const [formErr, setFormErr] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [busy, setBusy] = useState(false);

  // Filter only properties that don't yet have an EMI record
  const propertiesWithoutEmi = properties.filter(
    (p) => !emis.find((e) => e.property_id === p.id)
  );

  function openAdd() {
    setFormErr("");
    setDraft({
      propertyId: propertiesWithoutEmi[0]?.id || properties[0]?.id || "",
      principal: "", rate: "", tenure: "",
      startDate: "", emiAmount: "", lender: "", emiDueDay: "5",
    });
    setAddOpen(true);
  }

  async function saveEmi() {
    if (!draft.propertyId) return setFormErr("Select a property.");
    if (!draft.principal || isNaN(draft.principal) || Number(draft.principal) <= 0) return setFormErr("Enter a valid loan amount.");
    if (!draft.rate || isNaN(draft.rate) || Number(draft.rate) <= 0) return setFormErr("Enter a valid interest rate.");
    if (!draft.tenure || isNaN(draft.tenure) || Number(draft.tenure) <= 0) return setFormErr("Enter a valid tenure in months.");
    if (!draft.startDate) return setFormErr("Select an EMI start date.");
    // Auto-calculate EMI if not entered
    const computedEmi = draft.emiAmount
      ? Number(draft.emiAmount)
      : Math.round(calcEMI(draft.principal, draft.rate, draft.tenure));
    setBusy(true);
    const res = await addEmi({ ...draft, emiAmount: computedEmi });
    setBusy(false);
    if (res.ok) setAddOpen(false);
    else setFormErr("Failed to save. Check console.");
  }

  // Summary: sum from the DB rows directly (same data as dashboard_summary view)
  const totalMonthlyEmi = emis.reduce((s, e) => s + Number(e.emi_amount || 0), 0);
  const totalOutstanding = emis.reduce((s, e) => {
    const prog = emiProgress(e.loan_amount, e.interest_rate, e.loan_tenure_months, e.loan_start_date);
    return s + prog.remainingAmount;
  }, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-black text-slate-900 dark:text-white">EMI Tracker</div>
          <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Track all your home loan EMIs in one place</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refreshEmis}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200 bg-white hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex flex-1 sm:flex-none w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus size={16} /> Add EMI
          </button>
        </div>
      </div>

      {/* Summary cards — "Total Monthly EMI" tile is the live Supabase sum */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Active Loans</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {loadingEmis ? "…" : String(emis.length)}
          </div>
        </div>
        {/* ★ THIS TILE IS LINKED TO dashboard "Monthly EMI (sum)" via Supabase property_emi → dashboard_summary */}
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-amber-200 dark:ring-amber-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Total Monthly EMI</div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            {loadingEmis ? "…" : inr(Math.round(totalMonthlyEmi))}
          </div>
          <div className="mt-1 text-[10px] font-semibold text-slate-400">↔ Synced with Dashboard</div>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Total Outstanding</div>
          <div className="mt-2 text-2xl font-black text-amber-700">
            {loadingEmis ? "…" : inr(Math.round(totalOutstanding))}
          </div>
        </div>
      </div>

      {/* EMI List */}
      {loadingEmis ? (
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">Loading EMIs from Supabase…</div>
        </div>
      ) : emis.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
          <CreditCard size={40} className="mx-auto text-slate-300 mb-3" />
          <div className="text-lg font-black text-slate-900 dark:text-white">No EMIs tracked yet.</div>
          <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
            Click <span className="font-extrabold text-slate-900 dark:text-white">Add EMI</span> or add a property with a loan.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {emis.map((e) => {
            const emi = Number(e.emi_amount);
            const prog = emiProgress(e.loan_amount, e.interest_rate, e.loan_tenure_months, e.loan_start_date);
            const paidPct = e.loan_tenure_months > 0 ? Math.min((prog.paid / e.loan_tenure_months) * 100, 100) : 0;
            const isExpanded = expandedId === e.property_id;
            const totalPayable = emi * e.loan_tenure_months;
            const totalInterest = totalPayable - Number(e.loan_amount);
            const propTitle = e.properties?.title || "Property";

            return (
              <div key={e.property_id} className="rounded-3xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-base font-black text-slate-900 dark:text-white truncate">{propTitle}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge tone="teal">Principal {inr(e.loan_amount)}</Badge>
                        <Badge tone="amber">{e.interest_rate}% p.a.</Badge>
                        <Badge tone="slate">{e.loan_tenure_months} months</Badge>
                        {e.lender && <Badge tone="slate">{e.lender}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : e.property_id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                      >
                        {isExpanded ? <ChevronUp size={16} className="text-slate-600 dark:text-slate-400" /> : <ChevronDown size={16} className="text-slate-600 dark:text-slate-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEmi(e.property_id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200 hover:bg-rose-100"
                        title="Delete EMI"
                      >
                        <Trash2 size={14} className="text-rose-600" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs font-extrabold text-slate-600 dark:text-slate-400">Monthly EMI</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">{inr(Math.round(emi))}</div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                      <span>{prog.paid} months paid</span>
                      <span>{prog.remaining} months left</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 ring-1 ring-inset ring-slate-200 dark:ring-slate-600">
                      <div className="h-2.5 rounded-full transition-all" style={{ width: `${paidPct}%`, backgroundColor: ACCENT }} />
                    </div>
                    <div className="mt-1 text-right text-xs font-semibold text-slate-400">{paidPct.toFixed(1)}% complete</div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Loan Amount", val: inr(e.loan_amount), color: "text-slate-900 dark:text-white" },
                        { label: "Total Interest", val: inr(Math.round(totalInterest)), color: "text-amber-700" },
                        { label: "Total Payable", val: inr(Math.round(totalPayable)), color: "text-rose-700" },
                        { label: "Amount Paid", val: inr(Math.round(prog.paidAmount)), color: "text-emerald-700" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl bg-white dark:bg-slate-800 p-3 ring-1 ring-slate-200 dark:ring-slate-600 text-center">
                          <div className="text-xs font-semibold text-slate-500">{item.label}</div>
                          <div className={`mt-1 text-sm font-black ${item.color}`}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                    {e.loan_start_date && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Calendar size={13} className="shrink-0" />
                        <span>Start date: {new Date(e.loan_start_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                    )}
                    {e.properties?.address && (
                      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-400">
                        <MapPin size={13} className="shrink-0" />
                        <span>{e.properties.address}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add EMI Modal */}
      <Modal
        open={addOpen}
        title="Add EMI"
        onClose={() => setAddOpen(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button type="button" onClick={() => setAddOpen(false)} className="w-full sm:w-auto rounded-2xl bg-white dark:bg-slate-700 px-4 py-3 text-sm font-extrabold text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600">Cancel</button>
            <button type="button" onClick={saveEmi} disabled={busy} className="w-full sm:w-auto rounded-2xl px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
              {busy ? "Saving…" : "Add EMI"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          {formErr && <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-extrabold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800">{formErr}</div>}

          <Field label="Property">
            {properties.length > 0 ? (
              <select value={draft.propertyId} onChange={(e) => setDraft((d) => ({ ...d, propertyId: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
                {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            ) : (
              <div className="px-4 py-3 text-sm font-semibold text-slate-500">Add a property first.</div>
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Loan Amount (₹)">
              <input inputMode="numeric" value={draft.principal} onChange={(e) => setDraft((d) => ({ ...d, principal: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 5000000" />
            </Field>
            <Field label="Annual Interest Rate (%)">
              <input inputMode="decimal" value={draft.rate} onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 8.5" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tenure (months)">
              <input inputMode="numeric" value={draft.tenure} onChange={(e) => setDraft((d) => ({ ...d, tenure: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 240" />
            </Field>
            <Field label="EMI Start Date">
              <input type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Monthly EMI (₹) — leave blank to auto-calculate">
              <input inputMode="numeric" value={draft.emiAmount} onChange={(e) => setDraft((d) => ({ ...d, emiAmount: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="Auto" />
            </Field>
            <Field label="Lender / Bank">
              <input value={draft.lender} onChange={(e) => setDraft((d) => ({ ...d, lender: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. SBI, HDFC" />
            </Field>
          </div>

          {/* Live preview */}
          {draft.principal && draft.rate && draft.tenure ? (
            <div className="rounded-2xl bg-teal-50 dark:bg-teal-900/20 px-4 py-3 ring-1 ring-inset ring-teal-200 dark:ring-teal-800">
              <div className="text-xs font-extrabold text-teal-700 dark:text-teal-300">Calculated Monthly EMI</div>
              <div className="mt-1 text-xl font-black text-teal-800 dark:text-teal-200">{inr(Math.round(calcEMI(draft.principal, draft.rate, draft.tenure)))}</div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

// ─── RENTAL INCOME SECTION ────────────────────────────────────────────────────
function RentalIncomeSection({ properties, onMutate }) {
  const { receipts, loadingReceipts, addReceipt, removeReceipt, refreshReceipts } = useSupabaseReceipts(onMutate);
  const [logOpen, setLogOpen] = useState(false);
  const [draft, setDraft] = useState({ propertyId: "", amount: "", month: "", note: "", status: "Received" });
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  const rentedProps = properties.filter((p) => Number(p.rent) > 0);
  const totalMonthlyRent = rentedProps.reduce((s, p) => s + Number(p.rent), 0);
  const thisMonthKey = currentMonthKey();

  const thisMonthReceipts = receipts.filter((r) => r.month_key === thisMonthKey);
  const thisMonthTotal = thisMonthReceipts.filter((r) => r.received).reduce((s, r) => s + Number(r.amount), 0);
  const pendingCount = rentedProps.length - new Set(thisMonthReceipts.filter((r) => r.received).map((r) => r.property_id)).size;

  function openLog() {
    setFormErr("");
    setDraft({
      propertyId: rentedProps[0]?.id || "",
      amount: rentedProps[0] ? String(rentedProps[0].rent) : "",
      month: thisMonthKey,
      note: "",
      status: "Received",
    });
    setLogOpen(true);
  }

  async function saveReceipt() {
    if (!draft.propertyId) return setFormErr("Select a property.");
    if (!draft.amount || isNaN(draft.amount) || Number(draft.amount) <= 0) return setFormErr("Enter a valid amount.");
    if (!draft.month) return setFormErr("Select a month.");
    setBusy(true);
    const res = await addReceipt({ ...draft, amount: Number(draft.amount) });
    setBusy(false);
    if (res.ok) setLogOpen(false);
    else setFormErr("Failed to save. Check console.");
  }

  // Group by month_key for display
  const byMonth = receipts.reduce((acc, r) => {
    if (!acc[r.month_key]) acc[r.month_key] = [];
    acc[r.month_key].push(r);
    return acc;
  }, {});
  const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  function propName(id) { return properties.find((p) => p.id === id)?.title || id; }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-black text-slate-900 dark:text-white">Rental Income</div>
          <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Track rent collected from all properties</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refreshReceipts} className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-extrabold text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button type="button" onClick={openLog} className="inline-flex flex-1 sm:flex-none w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white" style={{ backgroundColor: ACCENT }}>
            <Plus size={16} /> Log Payment
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Expected / Month</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{inr(totalMonthlyRent)}</div>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-emerald-200 dark:ring-emerald-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Collected This Month</div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            {loadingReceipts ? "…" : inr(thisMonthTotal)}
          </div>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Pending This Month</div>
          <div className="mt-2 text-2xl font-black text-amber-700">{Math.max(0, pendingCount)} propert{pendingCount === 1 ? "y" : "ies"}</div>
        </div>
      </div>

      {/* Per-property status for current month */}
      {rentedProps.length > 0 && (
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-sm font-black text-slate-900 dark:text-white mb-4">This Month's Status</div>
          <div className="space-y-3">
            {rentedProps.map((p) => {
              const collected = receipts.find((r) => r.property_id === p.id && r.month_key === thisMonthKey && r.received);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {collected
                      ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                      : <AlertCircle size={18} className="text-amber-500 shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{p.title}</div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{p.address}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-black text-slate-900 dark:text-white">{inr(p.rent)}</div>
                    <Badge tone={collected ? "green" : "amber"}>{collected ? "Received" : "Pending"}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment history */}
      {loadingReceipts ? (
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">Loading from Supabase…</div>
        </div>
      ) : receipts.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
          <IndianRupee size={40} className="mx-auto text-slate-300 mb-3" />
          <div className="text-lg font-black text-slate-900 dark:text-white">No payments logged yet.</div>
          <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">Click <span className="font-extrabold text-slate-900 dark:text-white">Log Payment</span> when you receive rent.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMonths.map((month) => {
            const monthTotal = byMonth[month].filter((r) => r.received).reduce((s, r) => s + Number(r.amount), 0);
            const [yr, mo] = month.split("-");
            const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
            return (
              <div key={month} className="rounded-3xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="text-sm font-black text-slate-900 dark:text-white">{label}</div>
                  <Badge tone="green">Total {inr(monthTotal)}</Badge>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {byMonth[month].map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {r.received
                          ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          : <AlertCircle size={16} className="text-amber-500 shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{propName(r.property_id)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 dark:text-white">{inr(r.amount)}</div>
                          <Badge tone={r.received ? "green" : "amber"}>{r.received ? "Received" : "Pending"}</Badge>
                        </div>
                        <button type="button" onClick={() => removeReceipt(r.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200 hover:bg-rose-100" title="Delete">
                          <X size={13} className="text-rose-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Payment Modal */}
      <Modal
        open={logOpen}
        title="Log Rent Payment"
        onClose={() => setLogOpen(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button type="button" onClick={() => setLogOpen(false)} className="w-full sm:w-auto rounded-2xl bg-white dark:bg-slate-700 px-4 py-3 text-sm font-extrabold text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600">Cancel</button>
            <button type="button" onClick={saveReceipt} disabled={busy} className="w-full sm:w-auto rounded-2xl px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          {formErr && <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-extrabold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800">{formErr}</div>}

          <Field label="Property">
            {rentedProps.length > 0 ? (
              <select
                value={draft.propertyId}
                onChange={(e) => {
                  const p = properties.find((x) => x.id === e.target.value);
                  setDraft((d) => ({ ...d, propertyId: e.target.value, amount: p ? String(p.rent) : d.amount }));
                }}
                className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
              >
                {rentedProps.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            ) : (
              <div className="px-4 py-3 text-sm font-semibold text-slate-500">No properties with rent set.</div>
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount (₹)">
              <input inputMode="numeric" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="0" />
            </Field>
            <Field label="Month (YYYY-MM)">
              <input type="month" value={draft.month} onChange={(e) => setDraft((d) => ({ ...d, month: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" />
            </Field>
          </div>

          <Field label="Status">
            <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
              <option>Received</option>
              <option>Pending</option>
            </select>
          </Field>

          <Field label="Note (optional)">
            <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. Paid via NEFT" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ─── DOCUMENTS SECTION ────────────────────────────────────────────────────────
// Metadata stored in localStorage (no dedicated table needed for docs metadata)
function useDocStorage() {
  const KEY = "propvault_docs";
  const [docs, setDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  function save(list) { setDocs(list); localStorage.setItem(KEY, JSON.stringify(list)); }
  function add(d) { save([{ ...d, id: Date.now().toString(), addedOn: new Date().toISOString() }, ...docs]); }
  function remove(id) { save(docs.filter((d) => d.id !== id)); }
  return { docs, addDoc: add, removeDoc: remove };
}

const DOC_TYPES = ["Sale Deed", "Registration Certificate", "Khata Certificate", "Property Tax Receipt", "Loan Agreement", "NOC", "Power of Attorney", "Rental Agreement", "Blueprint / Plan", "Insurance", "Other"];

function DocumentsSection({ properties }) {
  const { docs, addDoc, removeDoc } = useDocStorage();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", docType: "Sale Deed", propertyId: "", note: "", date: "" });
  const [formErr, setFormErr] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterType, setFilterType] = useState("all");

  function openAdd() {
    setFormErr("");
    setDraft({ name: "", docType: "Sale Deed", propertyId: properties[0]?.id || "", note: "", date: new Date().toISOString().split("T")[0] });
    setAddOpen(true);
  }

  function saveDoc() {
    if (!draft.name.trim()) return setFormErr("Document name is required.");
    addDoc({ ...draft });
    setAddOpen(false);
  }

  const filtered = docs.filter((d) => {
    const matchProp = filterProp === "all" || d.propertyId === filterProp;
    const matchType = filterType === "all" || d.docType === filterType;
    return matchProp && matchType;
  });

  function propName(id) { return properties.find((p) => p.id === id)?.title || "General"; }

  const docTypeColors = {
    "Sale Deed": "teal", "Loan Agreement": "amber", "Rental Agreement": "green",
    "Registration Certificate": "teal", "Property Tax Receipt": "slate",
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-black text-slate-900 dark:text-white">Documents</div>
          <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Organise and track all property documents</div>
        </div>
        <button type="button" onClick={openAdd} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white" style={{ backgroundColor: ACCENT }}>
          <Plus size={16} /> Add Document
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Total Documents</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{docs.length}</div>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Properties Covered</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{new Set(docs.map((d) => d.propertyId).filter(Boolean)).size}</div>
        </div>
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Document Types</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{new Set(docs.map((d) => d.docType)).size}</div>
        </div>
      </div>

      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
            <select value={filterProp} onChange={(e) => setFilterProp(e.target.value)} className="bg-transparent px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none">
              <option value="all">All Properties</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-transparent px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none">
              <option value="all">All Types</option>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <div className="text-lg font-black text-slate-900 dark:text-white">No documents yet.</div>
          <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">Click <span className="font-extrabold text-slate-900 dark:text-white">Add Document</span> to track your property papers.</div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3 py-2 ring-1 ring-inset ring-amber-200 text-xs font-semibold text-amber-700">
            <Info size={13} /> Document metadata is stored locally.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">No documents match the selected filters.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((d) => (
            <div key={d.id} className="relative rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm min-w-0">
              <button type="button" onClick={() => removeDoc(d.id)} className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200 hover:bg-rose-100" title="Delete">
                <Trash2 size={13} className="text-rose-600" />
              </button>
              <div className="flex items-start gap-3 pr-8 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-inset ring-teal-100">
                  <FileText size={18} className="text-teal-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate">{d.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone={docTypeColors[d.docType] || "slate"}>{d.docType}</Badge>
                    {d.propertyId && <Badge tone="teal">{propName(d.propertyId)}</Badge>}
                  </div>
                </div>
              </div>
              {d.note && <div className="mt-3 text-xs font-semibold text-slate-500 break-words">{d.note}</div>}
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Calendar size={12} className="shrink-0" />
                {d.date ? new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                <span className="mx-1 text-slate-200">|</span>
                Added {new Date(d.addedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        title="Add Document"
        onClose={() => setAddOpen(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button type="button" onClick={() => setAddOpen(false)} className="w-full sm:w-auto rounded-2xl bg-white dark:bg-slate-700 px-4 py-3 text-sm font-extrabold text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600">Cancel</button>
            <button type="button" onClick={saveDoc} className="w-full sm:w-auto rounded-2xl px-4 py-3 text-sm font-extrabold text-white" style={{ backgroundColor: ACCENT }}>Save Document</button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          {formErr && <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-extrabold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800">{formErr}</div>}
          <Field label="Document Name">
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. Sale Deed – Andheri Flat" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Document Type">
              <select value={draft.docType} onChange={(e) => setDraft((d) => ({ ...d, docType: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Property (optional)">
              <select value={draft.propertyId} onChange={(e) => setDraft((d) => ({ ...d, propertyId: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
                <option value="">— General —</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Document Date">
            <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" />
          </Field>
          <Field label="Note (optional)">
            <textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} className="min-h-[80px] w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. Original stored in bank locker" />
          </Field>
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 ring-1 ring-inset ring-amber-200 dark:ring-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>Only metadata is saved here. To store the actual file, enable Supabase Storage.</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── LOAN ADVISOR SECTION ─────────────────────────────────────────────────────
function LoanAdvisorSection() {
  const [calc, setCalc] = useState({ loanAmount: "", rate: "", tenure: "" });
  const [eligibility, setEligibility] = useState({ income: "", obligations: "", rate: "", tenure: "" });
  const [tab, setTab] = useState("calc");

  const emiResult = useMemo(() => {
    const { loanAmount, rate, tenure } = calc;
    if (!loanAmount || !rate || !tenure) return null;
    const P = Number(loanAmount);
    const r = Number(rate) / 12 / 100;
    const n = Number(tenure);
    if (!P || !n || isNaN(r)) return null;
    const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayable = emi * n;
    const totalInterest = totalPayable - P;
    return { emi, totalPayable, totalInterest, principal: P };
  }, [calc]);

  const eligResult = useMemo(() => {
    const { income, obligations, rate, tenure } = eligibility;
    if (!income || !rate || !tenure) return null;
    const net = Number(income) - Number(obligations || 0);
    const maxEmi = net * 0.5;
    const r = Number(rate) / 12 / 100;
    const n = Number(tenure);
    if (!net || !n || isNaN(r)) return null;
    const maxLoan = r === 0 ? maxEmi * n : (maxEmi * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
    return { maxLoan, maxEmi, net };
  }, [eligibility]);

  const breakdownPct = emiResult ? (emiResult.principal / emiResult.totalPayable) * 100 : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <div className="text-2xl font-black text-slate-900 dark:text-white">Loan Advisor</div>
        <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Calculate EMI and check loan eligibility</div>
      </div>

      <div className="flex gap-2 rounded-2xl bg-slate-100 dark:bg-slate-700 p-1 w-fit">
        {[
          { key: "calc", label: "EMI Calculator", icon: Calculator },
          { key: "eligibility", label: "Eligibility Check", icon: CheckCircle2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition ${tab === key ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-500" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "calc" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm space-y-4">
            <div className="text-sm font-black text-slate-900 dark:text-white">Loan Details</div>
            <Field label="Loan Amount (₹)">
              <input inputMode="numeric" value={calc.loanAmount} onChange={(e) => setCalc((c) => ({ ...c, loanAmount: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 5000000" />
            </Field>
            <Field label="Annual Interest Rate (%)">
              <input inputMode="decimal" value={calc.rate} onChange={(e) => setCalc((c) => ({ ...c, rate: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 8.5" />
            </Field>
            <Field label="Loan Tenure (months)">
              <input inputMode="numeric" value={calc.tenure} onChange={(e) => setCalc((c) => ({ ...c, tenure: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 240 (20 yrs)" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {[60, 120, 180, 240, 300, 360].map((m) => (
                <button key={m} type="button" onClick={() => setCalc((c) => ({ ...c, tenure: String(m) }))}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold ring-1 ring-inset transition ${calc.tenure === String(m) ? "bg-teal-600 text-white ring-teal-600" : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"}`}>
                  {m / 12}yr
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {emiResult ? (
              <>
                <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Monthly EMI</div>
                  <div className="mt-2 text-4xl font-black text-slate-900 dark:text-white">{inr(Math.round(emiResult.emi))}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Principal</div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{inr(emiResult.principal)}</div>
                  </div>
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Total Interest</div>
                    <div className="mt-1 text-lg font-black text-amber-700">{inr(Math.round(emiResult.totalInterest))}</div>
                  </div>
                  <div className="col-span-2 rounded-3xl bg-white dark:bg-slate-800 p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Total Payable</div>
                    <div className="mt-1 text-xl font-black text-rose-700">{inr(Math.round(emiResult.totalPayable))}</div>
                  </div>
                </div>
                <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                  <div className="text-xs font-extrabold text-slate-600 mb-3">Principal vs Interest Split</div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-4 transition-all" style={{ width: `${breakdownPct}%`, backgroundColor: ACCENT }} />
                    <div className="h-4 flex-1 bg-amber-400" />
                  </div>
                  <div className="mt-2 flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ACCENT }} />Principal {breakdownPct.toFixed(1)}%</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Interest {(100 - breakdownPct).toFixed(1)}%</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center h-full flex flex-col items-center justify-center gap-3">
                <Calculator size={40} className="text-slate-300" />
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">Fill in loan details to see your EMI</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">The result updates instantly</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "eligibility" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm space-y-4">
            <div className="text-sm font-black text-slate-900 dark:text-white">Your Financial Profile</div>
            <Field label="Monthly Gross Income (₹)">
              <input inputMode="numeric" value={eligibility.income} onChange={(e) => setEligibility((c) => ({ ...c, income: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 150000" />
            </Field>
            <Field label="Existing EMI Obligations (₹/month)">
              <input inputMode="numeric" value={eligibility.obligations} onChange={(e) => setEligibility((c) => ({ ...c, obligations: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 20000" />
            </Field>
            <Field label="Expected Interest Rate (%)">
              <input inputMode="decimal" value={eligibility.rate} onChange={(e) => setEligibility((c) => ({ ...c, rate: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 8.5" />
            </Field>
            <Field label="Desired Tenure (months)">
              <input inputMode="numeric" value={eligibility.tenure} onChange={(e) => setEligibility((c) => ({ ...c, tenure: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 240" />
            </Field>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-700 px-4 py-3 ring-1 ring-inset ring-slate-200 dark:ring-slate-600 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-start gap-2">
              <Info size={13} className="shrink-0 mt-0.5" />
              Banks typically allow a Fixed Obligation to Income Ratio (FOIR) of up to 50%.
            </div>
          </div>

          <div className="space-y-3">
            {eligResult ? (
              <>
                <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Estimated Loan Eligibility</div>
                  <div className="mt-2 text-4xl font-black text-emerald-700">{inr(Math.round(eligResult.maxLoan))}</div>
                  <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Based on 50% FOIR of your net available income</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Max EMI You Can Pay</div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{inr(Math.round(eligResult.maxEmi))}</div>
                  </div>
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Available Net Income</div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{inr(eligResult.net)}</div>
                  </div>
                </div>
                <div className="rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 p-5 ring-1 ring-emerald-200 dark:ring-emerald-800">
                  <div className="text-xs font-extrabold text-emerald-700 mb-2">Quick Tips</div>
                  <ul className="space-y-1.5 text-xs font-semibold text-emerald-800">
                    <li>• A higher credit score (750+) can get you better interest rates.</li>
                    <li>• Paying off existing obligations before applying increases eligibility.</li>
                    <li>• Longer tenure lowers EMI but increases total interest paid.</li>
                    <li>• Co-applicant income can significantly boost eligibility.</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center h-full flex flex-col items-center justify-center gap-3">
                <BadgePercent size={40} className="text-slate-300" />
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">Fill in your income details</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">We'll estimate how much loan you qualify for</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function HomePage() {
  const { properties, loading, busy, error, insertProperty, deleteProperty } = useProperties();
  const { summary, loadingSummary, refreshSummary } = useDashboardSummary();

  const [section, setSection] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [emiRefreshKey, setEmiRefreshKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "", address: "", type: "Residential Flat", status: "Vacant",
    rent: "", image_url: "",
    hasLoan: false, loanAmount: "", emiAmount: "", interestRate: "",
    tenureMonths: "", startDate: "", lenderName: "", loanType: "Home Loan",
  });
  const [formErr, setFormErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ★ Dashboard metrics now come from the dashboard_summary Supabase view.
  //   This is the SAME data source as Dashboard.js and the EMI/Rental tabs.
  const dashMetrics = useMemo(() => ({
    totalProps:  summary?.total_properties    ?? properties.length,
    totalRent:   summary?.total_monthly_rent  ?? 0,
    totalEmi:    summary?.total_monthly_emi   ?? 0,
    net:         summary?.net_per_month       ?? 0,
    totalValue:  summary?.total_portfolio_value ?? 0,
  }), [summary, properties.length]);

  function openAdd() {
    setFormErr("");
    setDraft({
      title: "", address: "", type: "Residential Flat", status: "Vacant",
      rent: "", image_url: "",
      hasLoan: false, loanAmount: "", emiAmount: "", interestRate: "",
      tenureMonths: "", startDate: "", lenderName: "", loanType: "Home Loan",
    });
    setAddOpen(true);
  }

  async function saveProperty() {
    setFormErr("");
    if (!String(draft.title || "").trim()) return setFormErr("Title is required.");
    if (!String(draft.address || "").trim()) return setFormErr("Address is required.");

    if (draft.hasLoan) {
      if (!draft.loanAmount || isNaN(draft.loanAmount) || Number(draft.loanAmount) <= 0)
        return setFormErr("Enter a valid loan amount.");
      if (!draft.interestRate || isNaN(draft.interestRate) || Number(draft.interestRate) <= 0)
        return setFormErr("Enter a valid interest rate.");
      if (!draft.tenureMonths || isNaN(draft.tenureMonths) || Number(draft.tenureMonths) <= 0)
        return setFormErr("Enter a valid tenure in months.");
      if (!draft.startDate)
        return setFormErr("Select an EMI start date.");
    }

    // Step 1 — Save property row
    const res = await insertProperty({
      title: draft.title.trim(),
      address: draft.address.trim(),
      type: draft.type,
      status: draft.status,
      rent: draft.rent === "" ? 0 : Number(draft.rent),
      image_url: draft.image_url.trim(),
    });
    if (!res.ok) return;

    // Step 2 — If loan, write to property_emi so EMI Tracker auto-populates
    if (draft.hasLoan && res.data?.id) {
      try {
        const computedEmi = draft.emiAmount && !isNaN(draft.emiAmount) && Number(draft.emiAmount) > 0
          ? Number(draft.emiAmount)
          : Math.round(calcEMI(draft.loanAmount, draft.interestRate, draft.tenureMonths));

        const { data: { user } } = await supabase.auth.getUser();
        const { error: emiErr } = await supabase.from("property_emi").upsert({
          property_id: res.data.id,
          user_id: user?.id,
          lender: draft.lenderName.trim() || null,
          loan_amount: Number(draft.loanAmount),
          interest_rate: Number(draft.interestRate),
          emi_amount: computedEmi,
          loan_start_date: draft.startDate,
          loan_tenure_months: Number(draft.tenureMonths),
          remaining_tenure_months: Number(draft.tenureMonths),
          emi_due_day: 5,
        }, { onConflict: "property_id" });
        if (emiErr) console.error("property_emi insert:", emiErr.message);
        else setEmiRefreshKey((k) => k + 1);
      } catch (e) {
        console.error("Supabase EMI error:", e);
      }
    }

    setAddOpen(false);
    // Refresh the dashboard summary so tiles update immediately
    refreshSummary();
  }

  function askDelete(p) { setDeleteTarget(p); setDeleteOpen(true); }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    const res = await deleteProperty(deleteTarget.id);
    if (!res.ok) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
    refreshSummary();
  }

  return (
    <div className="h-full min-h-0 w-full overflow-x-hidden bg-slate-50 dark:bg-slate-900">
      {mobileNavOpen ? (
        <button type="button" className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />
      ) : null}

      <div className="flex min-h-0 w-full max-w-full">
        {/* Sidebar */}
        <aside
          className={[
            "fixed z-50 inset-y-0 left-0 w-[280px] max-w-[85vw] transform transition-transform lg:static lg:translate-x-0 lg:z-auto lg:max-w-none",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
          style={{ backgroundColor: NAVY }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-y-auto">
            <div className="px-5 sm:px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/10">
                  <ShieldCheck size={18} className="text-teal-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-black text-white truncate">PropVault</div>
                  <div className="text-xs font-semibold text-slate-300">Portfolio</div>
                </div>
              </div>
            </div>

            <div className="px-3 pb-4">
              <div className="space-y-1">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const active = section === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => { setSection(s.key); setMobileNavOpen(false); }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${active ? "bg-white/10 text-white ring-1 ring-inset ring-white/10" : "text-slate-200 hover:bg-white/5"}`}
                    >
                      <Icon size={18} className={active ? "text-teal-300" : "text-slate-300"} />
                      <span className="truncate text-left">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto px-5 sm:px-6 py-6">
              <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                <div className="text-sm font-black text-white">Supabase mode</div>
                <div className="mt-1 text-xs font-semibold text-slate-300">
                  All data synced via <span className="text-white">dashboard_summary</span> view.
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <div className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur">
            <div className="flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4">
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
                <Menu size={18} className="text-slate-800 dark:text-slate-200" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">PropVault</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">Property Portfolio Console</div>
              </div>

              <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-700 px-3 py-2 ring-1 ring-inset ring-slate-200 dark:ring-slate-600 max-w-[45vw]">
                <Search size={16} className="text-slate-500 shrink-0" />
                <input className="w-full min-w-0 bg-transparent text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none" placeholder="Search…" disabled />
              </div>

              <button type="button" className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600" aria-label="Notifications">
                <Bell size={18} className="text-slate-700 dark:text-slate-300" />
              </button>
            </div>

            {error ? (
              <div className="px-3 sm:px-6 pb-3">
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-extrabold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800 break-words">{error}</div>
              </div>
            ) : null}
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-x-hidden px-3 sm:px-6 py-4 sm:py-6">
            {loading ? (
              <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">Loading…</div>
              </div>
            ) : null}

            {/* ── DASHBOARD ── */}
            {!loading && section === "dashboard" ? (
              <div className="space-y-4 sm:space-y-6">
                {/* ★ TILE ROW — all 4 tiles pull from dashboard_summary view */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm min-w-0">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Total Properties</div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {loadingSummary ? "…" : String(dashMetrics.totalProps)}
                    </div>
                  </div>

                  {/* ★ Monthly Rent tile — from property_rental via dashboard_summary */}
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-teal-200 dark:ring-teal-700 shadow-sm min-w-0">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Monthly Rent (sum)</div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {loadingSummary ? "…" : inr(dashMetrics.totalRent)}
                    </div>
                  </div>

                  {/* ★ Monthly EMI tile — LINKED to EMI Tracker "Total Monthly EMI" tile via property_emi → dashboard_summary */}
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-amber-200 dark:ring-amber-700 shadow-sm min-w-0">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Monthly EMI (sum)</div>
                    <div className="mt-2 text-2xl font-black text-rose-700">
                      {loadingSummary ? "…" : inr(dashMetrics.totalEmi)}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">↔ Synced with EMI Tracker</div>
                  </div>

                  {/* ★ Net/Month tile — Rental Income minus Monthly EMI, from dashboard_summary */}
                  <div className={`rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 shadow-sm min-w-0 ${dashMetrics.net >= 0 ? "ring-emerald-200" : "ring-rose-200"}`}>
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-400">Net / Month</div>
                    <div className={`mt-2 text-2xl font-black flex items-center gap-2 ${dashMetrics.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {loadingSummary ? "…" : (
                        <>
                          {dashMetrics.net >= 0
                            ? <ArrowUpRight size={20} className="shrink-0" />
                            : <ArrowDownRight size={20} className="shrink-0" />}
                          {inr(Math.abs(dashMetrics.net))}
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">Rent − EMI</div>
                  </div>
                </div>

                {/* Refresh button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={refreshSummary}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-700 px-4 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                  >
                    <RefreshCw size={13} />
                    Refresh Dashboard
                  </button>
                </div>

                <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm text-center">
                  <div className="text-sm font-black text-slate-900 dark:text-white">Getting started</div>
                  <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400 break-words">
                    Add properties with <span className="font-extrabold text-slate-900 dark:text-white">New Property</span>.{" "}
                    Attach a loan at add-time and it instantly updates the EMI Tracker and all dashboard tiles.
                  </div>
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={openAdd}
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                      style={{ backgroundColor: ACCENT }}
                    >
                      <Plus size={16} />
                      New Property
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* ── MY PROPERTIES ── */}
            {!loading && section === "properties" ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-2xl font-black text-slate-900 dark:text-white">My Properties</div>
                    <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Responsive grid • Supabase-backed</div>
                  </div>
                  <button type="button" onClick={openAdd} disabled={busy} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
                    <Plus size={16} /> New Property
                  </button>
                </div>

                {properties.length === 0 ? (
                  <div className="rounded-3xl bg-white dark:bg-slate-800 p-8 ring-1 ring-slate-200 dark:ring-slate-700 text-center">
                    <div className="text-lg font-black text-slate-900 dark:text-white">No properties yet.</div>
                    <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">Click <span className="font-extrabold text-slate-900 dark:text-white">New Property</span> to add one.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3 sm:gap-4">
                    {properties.map((p) => (
                      <div key={p.id} className="relative rounded-3xl bg-white dark:bg-slate-800 p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm min-w-0">
                        <button type="button" onClick={() => askDelete(p)} disabled={busy} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50" aria-label="Delete property">
                          <X size={16} />
                        </button>
                        <div className="pr-10 min-w-0">
                          <div className="text-lg font-black text-slate-900 dark:text-white truncate">{p.title}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone="slate">{p.type}</Badge>
                            <Badge tone="teal">{p.status}</Badge>
                            {Number(p.rent) > 0 ? <Badge tone="green">Rent {inr(p.rent)}</Badge> : <Badge tone="slate">No rent</Badge>}
                          </div>
                        </div>
                        <div className="mt-4 flex items-start gap-2 text-sm font-semibold text-slate-700 min-w-0">
                          <MapPin size={16} className="text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0 break-words dark:text-slate-300">{p.address}</div>
                        </div>
                        {p.image_url ? (
                          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
                            <img src={p.image_url} alt="" className="h-40 w-full object-cover" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* ── EMI TRACKER — passes refreshSummary as onMutate so dashboard updates on every add/delete */}
            {!loading && section === "emi" ? <EMITrackerSection key={emiRefreshKey} properties={properties} onMutate={refreshSummary} /> : null}

            {/* ── RENTAL INCOME — same pattern */}
            {!loading && section === "rental" ? <RentalIncomeSection properties={properties} onMutate={refreshSummary} /> : null}

            {/* ── DOCUMENTS ── */}
            {!loading && section === "documents" ? <DocumentsSection properties={properties} /> : null}

            {/* ── LOAN ADVISOR ── */}
            {!loading && section === "advisor" ? <LoanAdvisorSection /> : null}
          </div>
        </div>
      </div>

      {/* Add Property Modal */}
      <Modal
        open={addOpen}
        title="New Property"
        onClose={() => (busy ? null : setAddOpen(false))}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button type="button" disabled={busy} onClick={() => setAddOpen(false)} className="w-full sm:w-auto rounded-2xl bg-white dark:bg-slate-700 px-4 py-3 text-sm font-extrabold text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">Cancel</button>
            <button type="button" disabled={busy} onClick={saveProperty} className="w-full sm:w-auto rounded-2xl px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
              {busy ? "Saving…" : "Save Property"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          {formErr ? (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-extrabold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800 break-words">{formErr}</div>
          ) : null}

          <div className="space-y-1.5">
            <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Title</div>
            <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
              <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g., Andheri Flat" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Address</div>
            <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
              <textarea value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} className="min-h-[110px] w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="Full address" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Type</div>
              <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
                  <option>Residential Flat</option>
                  <option>Commercial Office</option>
                  <option>Plot/Land</option>
                  <option>Agricultural Land</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Status</div>
              <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
                  <option>Vacant</option>
                  <option>On Rent</option>
                  <option>Self-occupied</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Rent (₹ / month)</div>
              <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                <input value={draft.rent} onChange={(e) => setDraft((d) => ({ ...d, rent: e.target.value }))} inputMode="numeric" className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Image URL (optional)</div>
              <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                <input value={draft.image_url} onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="https://…" />
              </div>
            </div>
          </div>

          {/* ── LOAN SECTION ── */}
          <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-slate-50 dark:bg-slate-700/50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">Home Loan on this property?</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Loan details will be saved to EMI Tracker</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => setDraft((d) => ({ ...d, hasLoan: false }))} className={`rounded-xl px-4 py-2 text-sm font-extrabold ring-1 ring-inset transition ${!draft.hasLoan ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-100"}`}>No</button>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, hasLoan: true }))} className={`rounded-xl px-4 py-2 text-sm font-extrabold ring-1 ring-inset transition ${draft.hasLoan ? "text-white ring-teal-600" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-100"}`} style={draft.hasLoan ? { backgroundColor: ACCENT } : {}}>Yes</button>
              </div>
            </div>

            {draft.hasLoan && (
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Loan Amount (₹)</div>
                    <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                      <input inputMode="numeric" value={draft.loanAmount} onChange={(e) => setDraft((d) => ({ ...d, loanAmount: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 5000000" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Monthly EMI (₹)</div>
                    <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                      <input inputMode="numeric" value={draft.emiAmount} onChange={(e) => setDraft((d) => ({ ...d, emiAmount: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 43000" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Annual Interest Rate (%)</div>
                    <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                      <input inputMode="decimal" value={draft.interestRate} onChange={(e) => setDraft((d) => ({ ...d, interestRate: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 8.5" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Tenure (months)</div>
                    <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                      <input inputMode="numeric" value={draft.tenureMonths} onChange={(e) => setDraft((d) => ({ ...d, tenureMonths: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. 240" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">EMI Start Date</div>
                    <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                      <input type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Lender / Bank Name</div>
                    <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                      <input value={draft.lenderName} onChange={(e) => setDraft((d) => ({ ...d, lenderName: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none" placeholder="e.g. SBI, HDFC" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Loan Type</div>
                  <div className="rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-700">
                    <select value={draft.loanType} onChange={(e) => setDraft((d) => ({ ...d, loanType: e.target.value }))} className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
                      <option>Home Loan</option>
                      <option>Loan Against Property (LAP)</option>
                      <option>Plot Loan</option>
                      <option>Construction Loan</option>
                      <option>Top-up Loan</option>
                    </select>
                  </div>
                </div>

                {/* Live EMI preview */}
                {draft.loanAmount && draft.interestRate && draft.tenureMonths ? (() => {
                  const P = Number(draft.loanAmount);
                  const r = Number(draft.interestRate) / 12 / 100;
                  const n = Number(draft.tenureMonths);
                  if (!P || !n) return null;
                  const calcEmiVal = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  const totalInterest = calcEmiVal * n - P;
                  return (
                    <div className="rounded-2xl bg-teal-50 dark:bg-teal-900/20 px-4 py-3 ring-1 ring-inset ring-teal-200 dark:ring-teal-800 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-xs font-extrabold text-teal-700 dark:text-teal-300">Calculated EMI</div>
                        <div className="text-xl font-black text-teal-800 dark:text-teal-200">{inr(Math.round(calcEmiVal))}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-teal-700 dark:text-teal-300">Total Interest</div>
                        <div className="text-sm font-black text-amber-700">{inr(Math.round(totalInterest))}</div>
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            )}
          </div>
          {/* ── END LOAN SECTION ── */}
        </div>
      </Modal>

      <ConfirmDeletePropertyModal
        open={deleteOpen}
        title={deleteTarget?.title || deleteTarget?.name || ""}
        busy={busy}
        onCancel={() => (busy ? null : (setDeleteOpen(false), setDeleteTarget(null)))}
        onConfirm={confirmDelete}
      />
    </div>
  );
}