import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";

import { supabase } from "./supabaseClient";

import Home from "./Home";
import SignIn from "./SignIn";
import CreateAccount from "./CreateAccount";
import ForgetPass from "./ForgetPass";

import DashBoard from "./DashBoard";
import Charts from "./Charts";

import { useDarkMode } from "./useDarkMode";

import {
  BarChart3,
  LayoutDashboard,
  Home as HomeIcon,
  LogOut,
  ShieldCheck,
  Sparkles,
  Moon,
  Sun,
} from "lucide-react";

function FullscreenLoader({ label }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="rounded-3xl bg-white/5 ring-1 ring-inset ring-white/10 px-6 py-5 max-w-md w-full text-center">
        <div className="text-sm font-semibold text-slate-300">{label}</div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setSession(null);
        else setSession(data?.session ?? null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) return <FullscreenLoader label="Preparing your workspace…" />;
  if (!session) return <Navigate to="/signin" replace state={{ from: location }} />;

  return children;
}

function AppShell({ children }) {
  const location = useLocation();
  const [dark, setDark] = useDarkMode();

  const nav = useMemo(
    () => [
      { to: "/", label: "Home", icon: HomeIcon },
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/charts", label: "Charts", icon: BarChart3 },
    ],
    []
  );

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/signin");
  }

  return (
    <div className="min-h-screen bg-slate-950 overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-[420px] w-full bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="group flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10 flex items-center justify-center">
              <ShieldCheck className="text-teal-300" size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-white font-black tracking-tight leading-tight truncate">PropVault</div>
              <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 min-w-0">
                <span className="truncate">Premium portfolio console</span>
                <Sparkles size={14} className="text-teal-300 shrink-0" />
              </div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = location.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 sm:px-4 py-2 text-sm font-extrabold ring-1 ring-inset transition ${
                    active ? "bg-white/10 text-white ring-white/15" : "bg-white/0 text-slate-300 ring-white/10 hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} className={active ? "text-teal-300" : "text-slate-300"} />
                  <span className="whitespace-nowrap">{n.label}</span>
                </Link>
              );
            })}

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-3 sm:px-4 py-2 text-sm font-extrabold text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10 transition"
              title={dark ? "Switch to Light mode" : "Switch to Dark mode"}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              <span className="whitespace-nowrap hidden sm:inline">{dark ? "Light" : "Dark"}</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-3 sm:px-4 py-2 text-sm font-extrabold text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10 transition"
            >
              <LogOut size={16} />
              <span className="whitespace-nowrap">Logout</span>
            </button>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 rounded-[26px] sm:rounded-[30px] bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-inset ring-white/10 p-1 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          <div className="rounded-[22px] sm:rounded-[26px] bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-120px)] overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<CreateAccount />} />
        <Route path="/forget" element={<ForgetPass />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell>
                <Home />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashBoard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/charts"
          element={
            <ProtectedRoute>
              <AppShell>
                <Charts />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}