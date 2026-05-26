import React from "react";
import { X, AlertTriangle } from "lucide-react";

export default function ConfirmDeletePropertyModal({ open, title, onCancel, onConfirm, busy }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 ring-1 ring-inset ring-rose-200">
                <AlertTriangle className="text-rose-700" size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-base font-black text-slate-900">Remove property?</div>
                <div className="mt-1 text-xs font-semibold text-slate-600 break-words">
                  Are you sure you want to remove this property from your management system? This action cannot be undone.
                </div>
                {title ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-extrabold text-slate-900 ring-1 ring-inset ring-slate-200 break-words">
                    {title}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              aria-label="Close"
              title="Close"
            >
              <X size={18} className="text-slate-700" />
            </button>
          </div>

          <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="w-full sm:w-auto rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="w-full sm:w-auto rounded-2xl bg-rose-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-rose-700 disabled:bg-rose-300"
            >
              {busy ? "Removing…" : "Yes, remove"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}