"use client";

import { useEffect } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  icon = "warning",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-[#12121a] border border-[#252535] rounded-2xl w-full max-w-sm shadow-[0_24px_80px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className={`h-1 w-full ${destructive ? "bg-gradient-to-r from-red-500 to-rose-400" : "bg-gradient-to-r from-primary to-tertiary"}`} />

        <div className="p-6 flex flex-col gap-5">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${destructive ? "bg-red-500/10" : "bg-primary/10"}`}>
              <span
                className={`material-symbols-outlined text-[22px] ${destructive ? "text-red-400" : "text-primary"}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {icon}
              </span>
            </div>
            <div className="flex flex-col gap-1 pt-0.5 min-w-0">
              <h2 className="font-grotesk font-bold text-[17px] text-on-surface leading-tight">{title}</h2>
              <p className="text-sm text-on-surface-variant font-inter leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-semibold font-inter hover:text-on-surface hover:border-outline transition-all"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold font-inter transition-all active:scale-95 ${
                destructive
                  ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
                  : "bg-primary-container text-on-primary-container hover:opacity-90"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
