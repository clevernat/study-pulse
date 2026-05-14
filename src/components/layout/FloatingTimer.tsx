"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTimerStore, formatTime } from "@/store/timerStore";

const MODE_LABELS: Record<string, string> = {
  focus: "FOCUS",
  "short-break": "BREAK",
  "long-break": "LONG BREAK",
};

const MODE_COLORS: Record<string, { ring: string; text: string }> = {
  focus: { ring: "#7c3aed", text: "text-primary" },
  "short-break": { ring: "#40efb7", text: "text-secondary" },
  "long-break": { ring: "#ffb95f", text: "text-tertiary" },
};

export default function FloatingTimer() {
  const {
    state,
    mode,
    secondsRemaining,
    totalSeconds,
    selectedSubjectName,
    start,
    pause,
  } = useTimerStore();

  const pathname = usePathname();
  const cleanPath = pathname?.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  // Hide on the timer page (full timer is already visible) and when completely idle
  if (state === "idle" || cleanPath === "/timer") return null;

  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 1;
  const R = 22;
  const circumference = 2 * Math.PI * R;
  const dashOffset = circumference * progress;
  const colors = MODE_COLORS[mode] ?? MODE_COLORS.focus;

  const subjectLabel =
    selectedSubjectName && selectedSubjectName !== "Select a Subject"
      ? selectedSubjectName
      : null;

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <div className="flex items-center gap-3 bg-[#0e0e14] border border-[#2a2a40] rounded-2xl px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm">

        {/* Progress ring */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="24" cy="24" r={R} fill="none" stroke="#1e1e2e" strokeWidth="3" />
            <circle
              cx="24" cy="24" r={R}
              fill="none"
              stroke={colors.ring}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.4s linear" }}
            />
          </svg>
          {/* Pulsing dot when running */}
          {state === "running" && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ background: colors.ring, animation: "ping 1.5s ease-in-out infinite", opacity: 0.8 }}
            />
          )}
        </div>

        {/* Info column */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] uppercase tracking-[0.15em] font-bold ${colors.text}`}>
              {MODE_LABELS[mode] ?? "FOCUS"}
            </span>
            {state === "paused" && (
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant">· PAUSED</span>
            )}
          </div>
          <span className="font-jetbrains text-[22px] font-bold text-on-surface leading-tight tabular-nums">
            {formatTime(secondsRemaining)}
          </span>
          {subjectLabel && (
            <span className="text-[10px] text-on-surface-variant font-inter truncate max-w-[120px]">
              {subjectLabel}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-[#252535] mx-1 flex-shrink-0" />

        {/* Play / Pause */}
        <button
          onClick={state === "running" ? pause : start}
          className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-all flex-shrink-0"
          aria-label={state === "running" ? "Pause" : "Resume"}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ fontFamily: "'Material Symbols Outlined'", fontVariationSettings: "'FILL' 1" }}
          >
            {state === "running" ? "pause" : "play_arrow"}
          </span>
        </button>

        {/* Open full timer */}
        <Link
          href="/timer"
          className="w-9 h-9 rounded-full border border-[#252535] text-on-surface-variant flex items-center justify-center hover:text-primary hover:border-primary transition-all flex-shrink-0"
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
    </div>
  );
}
