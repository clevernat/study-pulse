"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";
import { subscribeSessions, subscribeSubjects } from "@/lib/firebase/firestore";
import { computeStreak, computeLongestStreak, hasPerfectWeek } from "@/lib/streakLogic";
import { getColor } from "@/lib/colorPalette";
import { localDateStr, formatSmartDuration, daysAgoStr } from "@/lib/dateUtils";
import ExamCountdownCard from "@/components/planner/ExamCountdownCard";
import { useCollection } from "@/lib/firebase/useCollection";
import { toCsv, downloadText } from "@/lib/csv";
import type { HeatmapCell, Session, Subject, Task } from "@/types";
import StatRow from "@/components/ui/StatRow";

function buildHeatmap(sessions: Session[]): HeatmapCell[] {
  const minutesByDate: Record<string, number> = {};
  for (const s of sessions) {
    minutesByDate[s.date] = (minutesByDate[s.date] ?? 0) + s.durationMinutes;
  }
  const cells: HeatmapCell[] = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = localDateStr(d);   // local date, not UTC
    const minutes = minutesByDate[date] ?? 0;
    const intensity: 0 | 1 | 2 | 3 | 4 =
      minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : minutes < 180 ? 3 : 4;
    cells.push({ date, minutes, intensity });
  }
  return cells;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

function focusColor(score: number): string {
  if (score >= 90) return "text-secondary";
  if (score >= 80) return "text-tertiary";
  return "text-error";
}

function heatIntensityClass(intensity: HeatmapCell["intensity"]): string {
  switch (intensity) {
    case 0: return "bg-surface-container";
    case 1: return "bg-secondary/20";
    case 2: return "bg-secondary/40";
    case 3: return "bg-secondary/70";
    case 4: return "bg-secondary";
  }
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function WeeklyBarChart({ sessions }: { sessions: Session[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return localDateStr(d);
  });

  const dayTotals = days.map((dateStr) => {
    const total = sessions
      .filter((s) => s.date === dateStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const dayLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
    const fullLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    return { day: dayLabel, fullLabel, minutes: total, dateStr };
  });

  const maxMinutes = Math.max(...dayTotals.map((d) => d.minutes), 1);
  // Nice round upper bound for Y axis: next 30-min boundary above max
  const yMax = Math.max(30, Math.ceil(maxMinutes / 30) * 30);
  const ticks = [yMax, Math.round(yMax * 0.66), Math.round(yMax * 0.33), 0];

  return (
    <div className="glass-card p-6 flex flex-col gap-3">
      <div>
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Study time this week</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">Minutes studied per day · last 7 days · hover a bar for details</p>
      </div>
      <div className="flex gap-3 mt-2">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between h-48 py-1 text-[10px] text-on-surface-variant font-jetbrains text-right w-9">
          {ticks.map((t) => (
            <span key={t}>{t}m</span>
          ))}
        </div>
        {/* Bars */}
        <div className="flex-1 relative">
          {/* Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
            {ticks.map((t, i) => (
              <div key={i} className="border-t border-outline-variant/30" />
            ))}
          </div>
          <div className="flex items-end justify-between h-48 gap-2 relative">
            {dayTotals.map((d, i) => {
              const isBest = d.minutes === maxMinutes && maxMinutes > 0;
              const pct = (d.minutes / yMax) * 100;
              const isHover = hover === i;
              return (
                <div
                  key={d.dateStr}
                  className="flex-1 flex flex-col items-center gap-2 relative cursor-pointer"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="w-full flex items-end" style={{ height: "160px" }}>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        d.minutes === 0
                          ? "bg-outline-variant/30"
                          : isBest
                            ? "bg-secondary"
                            : "bg-primary/60"
                      } ${isHover && d.minutes > 0 ? "opacity-100 shadow-[0_0_20px_rgba(94, 106, 210,0.4)]" : ""}`}
                      style={{ height: `${Math.max(pct, d.minutes > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-inter ${isBest ? "text-secondary font-semibold" : "text-on-surface-variant"}`}>
                    {d.day}
                  </span>
                  {isHover && (
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-10 bg-surface-container-lowest border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] whitespace-nowrap pointer-events-none">
                      <div className="text-[10px] text-on-surface-variant">{d.fullLabel}</div>
                      <div className="text-sm font-jetbrains text-on-surface font-semibold">
                        {d.minutes === 0 ? "No study" : `${d.minutes} min`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ sessions }: { sessions: Session[] }) {
  const cells = buildHeatmap(sessions);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  const totalDays = cells.filter((c) => c.minutes > 0).length;
  const totalMinutes = cells.reduce((s, c) => s + c.minutes, 0);

  return (
    <div className="glass-card p-6 flex flex-col gap-4 overflow-hidden relative">
      <div>
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Last 90 days</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {totalDays} active day{totalDays === 1 ? "" : "s"} · {formatSmartDuration(totalMinutes)} total
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-1 min-w-[260px]" style={{ gridTemplateColumns: "repeat(13, 1fr)" }}>
          {cells.map((cell, i) => (
            <div
              key={cell.date}
              onMouseEnter={(e) => {
                const r = (e.target as HTMLElement).getBoundingClientRect();
                const parent = (e.currentTarget.closest(".glass-card") as HTMLElement)?.getBoundingClientRect();
                if (parent) setHover({ idx: i, x: r.left - parent.left + r.width / 2, y: r.top - parent.top });
              }}
              onMouseLeave={() => setHover(null)}
              className={`w-full aspect-square rounded-sm ${heatIntensityClass(cell.intensity)} hover:ring-2 hover:ring-primary/50 cursor-pointer transition-all`}
            />
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as HeatmapCell["intensity"][]).map((i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${heatIntensityClass(i)}`} />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {hover !== null && (
        <div
          className="absolute z-20 bg-surface-container-lowest border border-primary/40 rounded-lg px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)] whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <div className="text-[10px] text-on-surface-variant">
            {new Date(cells[hover.idx].date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <div className="text-xs font-jetbrains text-on-surface font-semibold">
            {cells[hover.idx].minutes === 0 ? "No study" : `${cells[hover.idx].minutes} min`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Active Subjects ───────────────────────────────────────────────────────────

function ActiveSubjects({ subjects, sessions }: { subjects: Subject[]; sessions: Session[] }) {
  const minutesBySubject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sessions) {
      if (s.subjectId) m[s.subjectId] = (m[s.subjectId] ?? 0) + s.durationMinutes;
    }
    return m;
  }, [sessions]);

  const displayed = [...subjects]
    .sort((a, b) => (minutesBySubject[b.id] ?? 0) - (minutesBySubject[a.id] ?? 0))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Top subjects</h2>
        <Link href="/subjects" className="text-sm text-primary hover:opacity-80 transition-opacity">
          View all →
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {displayed.map((s) => {
          const c = getColor(s.color);
          const totalMins = minutesBySubject[s.id] ?? 0;
          return (
            <div key={s.id} className="glass-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                <span className="material-symbols-outlined text-xl" style={{ color: c.text }}>{s.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-grotesk font-bold text-sm text-on-surface truncate">{s.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: c.chip, color: c.chipText }}>{s.category}</span>
                </div>
                <span className="text-xs text-on-surface-variant">{formatSmartDuration(totalMins)} total</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recent Sessions ───────────────────────────────────────────────────────────

function RecentSessions({ sessions, subjectById }: { sessions: Session[]; subjectById: Map<string, Subject> }) {
  const displayed = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  function handleExport() {
    const header = ["Date", "Subject", "Duration (min)", "Focus Score", "Notes"];
    const rows = sessions.map((s) => [s.date, s.subjectName, s.durationMinutes, s.focusScore, s.notes ?? ""]);
    downloadText(toCsv([header, ...rows]), "study-sessions.csv", "text/csv");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Recent sessions</h2>
        <button onClick={handleExport} className="text-sm text-on-surface-variant border border-outline-variant px-3 py-1 rounded-full hover:border-primary hover:text-primary transition-all">
          Export CSV
        </button>
      </div>
      <div className="glass-card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left text-xs text-on-surface-variant px-4 py-3">Subject</th>
              <th className="text-left text-xs text-on-surface-variant px-4 py-3">Duration</th>
              <th className="text-left text-xs text-on-surface-variant px-4 py-3">Focus score</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((session: Session) => {
              const displayName = subjectById.get(session.subjectId)?.name ?? session.subjectName;
              return (
              <tr key={session.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container/30 transition-colors">
                <td className="px-4 py-3 text-sm text-on-surface font-inter">{displayName}</td>
                <td className="px-4 py-3 text-sm font-jetbrains text-on-surface-variant">
                  {formatDuration(session.durationMinutes)}
                </td>
                <td className={`px-4 py-3 text-sm font-jetbrains font-semibold ${focusColor(session.focusScore)}`}>
                  {session.focusScore}%
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

interface BadgeDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  earned: boolean;
}

function BadgesSection({ sessions }: { sessions: Session[] }) {
  const today = localDateStr();
  const dates = sessions.map((s) => s.date);
  const streak = computeStreak(dates, today);
  const longest = computeLongestStreak(dates);
  const totalHours = sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60;
  const totalSessions = sessions.length;
  const perfectWeek = hasPerfectWeek(dates, today);

  const badges: BadgeDef[] = [
    { id: "first",     icon: "flag",                  label: "First session",    desc: "Finished your first focus session", earned: totalSessions >= 1 },
    { id: "streak3",   icon: "local_fire_department", label: "3-day streak",     desc: "Studied 3 days in a row",           earned: streak >= 3 },
    { id: "streak7",   icon: "bolt",                  label: "Week warrior",     desc: "Studied 7 days in a row",           earned: streak >= 7 },
    { id: "streak30",  icon: "emoji_events",          label: "Unstoppable",      desc: "Studied 30 days in a row",          earned: streak >= 30 },
    { id: "perfectwk", icon: "calendar_month",        label: "Perfect week",     desc: "Studied every day this week",       earned: perfectWeek },
    { id: "hours10",   icon: "schedule",              label: "10 hours",         desc: "10 hours of focus in total",        earned: totalHours >= 10 },
    { id: "hours50",   icon: "hourglass_bottom",      label: "50 hours",         desc: "50 hours of focus in total",        earned: totalHours >= 50 },
    { id: "hours100",  icon: "rocket_launch",         label: "100 hours",        desc: "100 hours of focus in total",       earned: totalHours >= 100 },
    { id: "s10",       icon: "task_alt",              label: "10 sessions",      desc: "Finished 10 focus sessions",        earned: totalSessions >= 10 },
    { id: "s50",       icon: "military_tech",         label: "50 sessions",      desc: "Finished 50 focus sessions",        earned: totalSessions >= 50 },
    { id: "s100",      icon: "workspace_premium",     label: "100 sessions",     desc: "Finished 100 focus sessions",       earned: totalSessions >= 100 },
    { id: "longest7",  icon: "trending_up",           label: "Best streak: 7 days", desc: "A streak of 7+ days, ever",      earned: longest >= 7 },
  ];

  // Earned first; locked ones stay readable (no faded opacity) and say what unlocks them.
  const ordered = [...badges.filter((b) => b.earned), ...badges.filter((b) => !b.earned)];
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="badges-title">
      <div className="flex items-baseline justify-between">
        <h2 id="badges-title" className="font-grotesk font-bold text-lg text-on-surface">Badges</h2>
        <span className="text-sm text-on-surface-variant font-jetbrains">{earnedCount} of {badges.length} earned</span>
      </div>
      {earnedCount === 0 && (
        <p className="text-on-surface-variant text-sm">Finish your first focus session to earn your first badge.</p>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 border-t border-outline-variant">
        {ordered.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-3 border-b border-outline-variant">
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${b.earned ? "bg-primary-container/30 text-primary" : "bg-surface-container text-on-surface-variant"}`}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: b.earned ? "'FILL' 1" : "'FILL' 0" }}>{b.earned ? b.icon : "lock"}</span>
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${b.earned ? "text-on-surface" : "text-on-surface-variant"}`}>{b.label}</span>
              <span className="block text-xs text-on-surface-variant">{b.earned ? b.desc : `Locked · ${b.desc}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const { items: tasks } = useCollection<Task>("tasks");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub1 = subscribeSessions(user.uid, (data) => {
      setSessions(data);
      setLoading(false);
    });
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Compute weekly hours from loaded sessions (compare date strings directly — no UTC shift)
  const weeklyHours = (() => {
    const weekAgoStr = daysAgoStr(6); // 7 days including today
    return sessions
      .filter((s) => s.date >= weekAgoStr)
      .reduce((sum, s) => sum + s.durationMinutes / 60, 0);
  })();

  const streakDays = computeStreak(
    sessions.map((s) => s.date),
    localDateStr()
  );

  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);

  const dailyAvg = (() => {
    const uniqueDays = new Set(sessions.map((s) => s.date)).size;
    if (uniqueDays === 0) return 0;
    const totalHours = sessions.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
    return totalHours / uniqueDays;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <StatRow stats={[
        { label: "Current streak", value: `${streakDays} ${streakDays === 1 ? "day" : "days"}` },
        { label: "Studied this week", value: formatSmartDuration(Math.round(weeklyHours * 60)) },
        { label: "Daily average this week", value: formatSmartDuration(Math.round(dailyAvg * 60)) },
      ]} />

      {/* Exam countdown */}
      <ExamCountdownCard subjects={subjects} tasks={tasks} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeeklyBarChart sessions={sessions} />
        </div>
        <div>
          <Heatmap sessions={sessions} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <ActiveSubjects subjects={subjects} sessions={sessions} />
        <RecentSessions sessions={sessions} subjectById={subjectById} />
      </div>

      {/* Badges */}
      <BadgesSection sessions={sessions} />
    </div>
  );
}
