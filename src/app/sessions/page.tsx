"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeSessions, subscribeSubjects } from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import { localDateStr } from "@/lib/dateUtils";
import type { Session, Subject } from "@/types";

// ── helpers ──────────────────────────────────────────────────────────────────

const SESSIONS_PER_DAY_PREVIEW = 8;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

function focusColorClass(score: number): string {
  if (score >= 90) return "text-secondary bg-secondary/10 border-secondary/30";
  if (score >= 80) return "text-tertiary bg-tertiary/10 border-tertiary/30";
  return "text-error bg-error/10 border-error/30";
}

function dotHex(color: string): string {
  return getColor(color).dot;
}

// ── Filter logic ──────────────────────────────────────────────────────────────

type Filter = "All" | "Today" | "This Week" | "This Month";
const FILTERS: Filter[] = ["All", "Today", "This Week", "This Month"];

function applyFilter(sessions: Session[], filter: Filter, todayStr: string, weekAgoStr: string, monthStr: string): Session[] {
  if (filter === "All") return sessions;
  if (filter === "Today") return sessions.filter((s) => s.date === todayStr);
  if (filter === "This Week") {
    return sessions.filter((s) => s.date >= weekAgoStr && s.date <= todayStr);
  }
  if (filter === "This Month") {
    return sessions.filter((s) => s.date.startsWith(monthStr));
  }
  return sessions;
}

// ── Date label helpers ───────────────────────────────────────────────────────

function formatDateLabel(dateStr: string, todayStr: string, yesterdayStr: string): string {
  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// ── Day group ────────────────────────────────────────────────────────────────

interface DayGroupProps {
  date: string;
  sessions: Session[];
  label: string;
  defaultOpen: boolean;
  subjectById: Map<string, Subject>;
}

function DayGroup({ date, sessions, label, defaultOpen, subjectById }: DayGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);

  const minutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const avgFocus = Math.round(sessions.reduce((acc, s) => acc + s.focusScore, 0) / sessions.length);
  const sorted = [...sessions].sort((a, b) => b.startTime.localeCompare(a.startTime));
  const visible = showAll ? sorted : sorted.slice(0, SESSIONS_PER_DAY_PREVIEW);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div key={date} className="flex flex-col gap-3">
      {/* Day header (clickable) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass-card flex items-center gap-4 px-4 py-3 text-left hover:border-primary/40 transition-colors"
      >
        <span
          className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          chevron_right
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-grotesk font-semibold text-sm text-on-surface">{label}</div>
          <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5 flex-wrap">
            <span>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
            <span className="opacity-50">·</span>
            <span className="font-jetbrains">{formatDuration(minutes)}</span>
            <span className="opacity-50">·</span>
            <span className={`font-jetbrains ${focusColorClass(avgFocus).split(" ")[0]}`}>{avgFocus}%</span>
          </div>
        </div>
      </button>

      {/* Sessions list */}
      {open && (
        <div className="flex flex-col gap-2 pl-2">
          {visible.map((session) => {
            const sub = subjectById.get(session.subjectId);
            const displayName = sub?.name ?? session.subjectName;
            const dotHexColor = dotHex(sub?.color ?? session.subjectColor);
            const scoreClasses = focusColorClass(session.focusScore);

            return (
              <div
                key={session.id}
                className="glass-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dotHexColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-inter font-semibold text-sm text-on-surface">
                        {displayName}
                      </span>
                      <span className="font-jetbrains text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                        {formatDuration(session.durationMinutes)}
                      </span>
                      {session.pomodoroCount > 0 && (
                        <span className="text-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">timer</span>
                          {session.pomodoroCount} pomodoro{session.pomodoroCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs text-on-surface-variant font-inter">
                    {session.startTime} – {session.endTime}
                  </span>
                  <div
                    className={`font-jetbrains font-semibold text-sm px-3 py-1 rounded-full border ${scoreClasses}`}
                  >
                    {session.focusScore}%
                  </div>
                </div>
              </div>
            );
          })}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-on-surface-variant hover:text-primary transition-colors font-inter py-2 self-start pl-4"
            >
              Show {hiddenCount} more {hiddenCount === 1 ? "session" : "sessions"} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeSessions(user.uid, setSessions);
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);

  const todayStr = localDateStr();
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgoStr = localDateStr(weekAgoDate);
  const monthStr = todayStr.slice(0, 7);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = localDateStr(yesterdayDate);

  const filtered = applyFilter(sessions, activeFilter, todayStr, weekAgoStr, monthStr);

  const totalSessions = filtered.length;
  const totalMinutes = filtered.reduce((acc, s) => acc + s.durationMinutes, 0);
  const avgFocus =
    filtered.length > 0
      ? Math.round(filtered.reduce((acc, s) => acc + s.focusScore, 0) / filtered.length)
      : 0;

  const { sortedDates, grouped } = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return {
      grouped: map,
      sortedDates: Array.from(map.keys()).sort((a, b) => b.localeCompare(a)),
    };
  }, [filtered]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header + Filters */}
      <div className="flex flex-col gap-4">
        <h1 className="font-grotesk font-bold text-3xl text-on-surface">Study Sessions</h1>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-inter font-medium border transition-all ${
                activeFilter === f
                  ? "bg-primary text-on-primary border-primary"
                  : "text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <div className="glass-card p-6 flex flex-col gap-1">
          <div className="font-jetbrains font-semibold text-2xl text-on-surface">{totalSessions}</div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Total Sessions</div>
        </div>
        <div className="glass-card p-6 flex flex-col gap-1">
          <div className="font-jetbrains font-semibold text-2xl text-on-surface">{formatDuration(totalMinutes)}</div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Total Time</div>
        </div>
        <div className="glass-card p-6 flex flex-col gap-1">
          <div className={`font-jetbrains font-semibold text-2xl ${focusColorClass(avgFocus).split(" ")[0]}`}>
            {avgFocus}%
          </div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Avg Focus Score</div>
        </div>
      </div>

      {/* Session Groups */}
      <div className="flex flex-col gap-4">
        {sessions.length === 0 && (
          <div className="glass-card p-12 text-center text-on-surface-variant font-inter">
            No study sessions yet. Start the timer to log your first session.
          </div>
        )}
        {sessions.length > 0 && sortedDates.length === 0 && (
          <div className="glass-card p-8 text-center text-on-surface-variant font-inter">
            No sessions found for this filter.
          </div>
        )}
        {sortedDates.map((date, idx) => (
          <DayGroup
            key={date}
            date={date}
            sessions={grouped.get(date)!}
            label={formatDateLabel(date, todayStr, yesterdayStr)}
            // Today expanded by default; first day in non-today filters also expanded
            defaultOpen={date === todayStr || (idx === 0 && !sortedDates.includes(todayStr))}
            subjectById={subjectById}
          />
        ))}
      </div>
    </div>
  );
}
