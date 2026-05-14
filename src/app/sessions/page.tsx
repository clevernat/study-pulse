"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserSessions } from "@/lib/firebase/firestore";
import type { Session } from "@/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function focusColorClass(score: number): string {
  if (score >= 90) return "text-secondary bg-secondary/10 border-secondary/30";
  if (score >= 80) return "text-tertiary bg-tertiary/10 border-tertiary/30";
  return "text-error bg-error/10 border-error/30";
}

function dotColorClass(color: Session["subjectColor"]): string {
  switch (color) {
    case "primary":   return "bg-primary";
    case "secondary": return "bg-secondary";
    case "tertiary":  return "bg-tertiary";
  }
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

// ── Group by date ─────────────────────────────────────────────────────────────

function groupByDate(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return map;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserSessions(user.uid).then((firestoreSessions) => {
      setSessions(firestoreSessions);
    });
  }, [user]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgoStr = weekAgoDate.toISOString().slice(0, 10);
  const monthStr = new Date().toISOString().slice(0, 7);

  const filtered = applyFilter(sessions, activeFilter, todayStr, weekAgoStr, monthStr);

  // Summary stats
  const totalSessions = filtered.length;
  const totalMinutes = filtered.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const avgFocus =
    filtered.length > 0
      ? Math.round(filtered.reduce((acc, s) => acc + s.focusScore, 0) / filtered.length)
      : 0;

  // Group by date (sorted descending)
  const grouped = groupByDate(filtered);
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  // Subject lookup for color (built from loaded sessions)
  const subjectById = new Map(sessions.map((s) => [s.subjectId, { id: s.subjectId, category: "" }]));

  return (
    <div className="flex flex-col gap-8">
      {/* Header + Filters */}
      <div className="flex flex-col gap-4">
        <h1 className="font-grotesk font-bold text-3xl text-on-surface">Study Sessions</h1>
        <div className="flex gap-2">
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
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col gap-1">
          <div className="font-jetbrains font-semibold text-2xl text-on-surface">{totalSessions}</div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Total Sessions</div>
        </div>
        <div className="glass-card p-6 flex flex-col gap-1">
          <div className="font-jetbrains font-semibold text-2xl text-on-surface">{totalHours}h</div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Total Hours</div>
        </div>
        <div className="glass-card p-6 flex flex-col gap-1">
          <div className={`font-jetbrains font-semibold text-2xl ${focusColorClass(avgFocus).split(" ")[0]}`}>
            {avgFocus}%
          </div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Avg Focus Score</div>
        </div>
      </div>

      {/* Session Groups */}
      <div className="flex flex-col gap-6">
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
        {sortedDates.map((date) => {
          const daySessions = grouped.get(date)!;
          return (
            <div key={date} className="flex flex-col gap-3">
              {/* Date header */}
              <h3 className="font-grotesk font-semibold text-sm text-on-surface-variant uppercase tracking-widest">
                {formatDateLabel(date)}
              </h3>

              {/* Session cards */}
              {daySessions.map((session) => {
                const subject = subjectById.get(session.subjectId);
                const dotClass = dotColorClass(session.subjectColor);
                const scoreClasses = focusColorClass(session.focusScore);

                return (
                  <div
                    key={session.id}
                    className="glass-card p-4 flex items-center justify-between gap-4"
                  >
                    {/* Left */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-inter font-semibold text-sm text-on-surface">
                            {session.subjectName}
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
                        {subject?.category && (
                          <div className="mt-1">
                            <span className="text-xs text-on-surface-variant">{subject.category}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right */}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
