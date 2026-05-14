"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTimerStore, formatTime } from "@/store/timerStore";

const MODE_LABELS: Record<string, string> = {
  focus: "FOCUS",
  "short-break": "SHORT BREAK",
  "long-break": "LONG BREAK",
};

const MODE_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  focus: { ring: "#7c3aed", text: "text-primary", bg: "bg-primary/10" },
  "short-break": { ring: "#40efb7", text: "text-secondary", bg: "bg-secondary/10" },
  "long-break": { ring: "#ffb95f", text: "text-tertiary", bg: "bg-tertiary/10" },
};

export default function FloatingTimer() {
  const { state, mode, secondsRemaining, totalSeconds, start, pause } = useTimerStore();
  const pathname = usePathname();

  // Hide on the timer page (main timer is already visible) and when idle
  const cleanPath = pathname?.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (state === "idle" || cleanPath === "/timer") return null;

  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 1;
  const R = 20;
  const circumference = 2 * Math.PI * R;
  const dashOffset = circumference * progress;
  const colors = MODE_COLORS[mode] ?? MODE_COLORS.focus;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-[#12121a] border border-[#252535] rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      {/* Ring */}
      <div className="relative w-12 h-12 flex-shrink-0">
        <svg width="48" height="48" className="rotate-[-90deg]">
          <circle cx="24" cy="24" r={R} fill="none" stroke="#252535" strokeWidth="3" />
          <circle
            cx="24" cy="24" r={R}
            fill="none"
            stroke={colors.ring}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-jetbrains text-[10px] font-bold ${colors.text}`}>
          {formatTime(secondsRemaining)}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${colors.text}`}>
          {MODE_LABELS[mode] ?? "FOCUS"}
        </span>
        <span className="font-jetbrains text-[18px] font-bold text-on-surface leading-tight tabular-nums">
          {formatTime(secondsRemaining)}
        </span>
      </div>

      {/* Play/Pause */}
      <button
        onClick={state === "running" ? pause : start}
        className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-all flex-shrink-0"
        aria-label={state === "running" ? "Pause" : "Resume"}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ fontFamily: "'Material Symbols Outlined'", fontVariationSettings: "'FILL' 1" }}
        >
          {state === "running" ? "pause" : "play_arrow"}
        </span>
      </button>

      {/* Go to Timer */}
      <Link
        href="/timer"
        className="w-9 h-9 rounded-full border border-outline-variant text-on-surface-variant flex items-center justify-center hover:text-primary hover:border-primary transition-all flex-shrink-0"
        aria-label="Open timer"
        title="Open full timer"
      >
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ fontFamily: "'Material Symbols Outlined'" }}
        >
          open_in_full
        </span>
      </Link>
    </div>
  );
}
