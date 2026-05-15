"use client";

import { useRef, useState, useEffect, useCallback } from "react";
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

  // Drag state
  const widgetRef = useRef<HTMLDivElement>(null);
  // null = use default CSS corner position; once dragged we switch to absolute px coords
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOrigin = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const isDragging = useRef(false);

  // Reset position when widget hides (timer resets/stops) so it returns to default corner
  useEffect(() => {
    if (state === "idle") setPos(null);
  }, [state]);

  // Pointer-based drag (works for both mouse and touch in modern browsers)
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start drag from interactive children
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = false;

    const rect = e.currentTarget.getBoundingClientRect();
    // Initialise pos from current rendered position (CSS corner → px coords)
    const currentX = pos?.x ?? rect.left;
    const currentY = pos?.y ?? rect.top;

    dragOrigin.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: currentX,
      posY: currentY,
    };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return;
    e.preventDefault();

    const dx = e.clientX - dragOrigin.current.startX;
    const dy = e.clientY - dragOrigin.current.startY;

    // Only start dragging after a small threshold (avoids mis-firing on taps)
    if (!isDragging.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    isDragging.current = true;

    const widget = widgetRef.current;
    if (!widget) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ww = widget.offsetWidth;
    const wh = widget.offsetHeight;

    const newX = Math.max(8, Math.min(vw - ww - 8, dragOrigin.current.posX + dx));
    const newY = Math.max(8, Math.min(vh - wh - 8, dragOrigin.current.posY + dy));

    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragOrigin.current = null;
  }, []);

  // Hide on the timer page and when idle
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

  // When dragging, use exact pixel coordinates; otherwise fall back to corner CSS
  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, bottom: "auto", right: "auto", zIndex: 100 }
    : {};

  return (
    <div
      ref={widgetRef}
      className={pos ? "" : "fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100]"}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="flex items-center gap-3 bg-[#0e0e14] border border-[#2a2a40] rounded-2xl px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm select-none"
        style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
      >
        {/* Drag handle hint */}
        <div className="flex flex-col gap-[3px] items-center justify-center w-3 flex-shrink-0 opacity-30">
          <span className="w-3 h-0.5 rounded-full bg-on-surface-variant" />
          <span className="w-3 h-0.5 rounded-full bg-on-surface-variant" />
          <span className="w-3 h-0.5 rounded-full bg-on-surface-variant" />
        </div>

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
