"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const datePart = now.toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timePart = now.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const tzAbbr = now.toLocaleTimeString("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).split(" ").pop();

  return (
    <p className="text-on-surface-variant mt-1 font-inter">
      {datePart}
      <span className="mx-2 text-outline-variant">·</span>
      <span className="font-jetbrains text-sm text-primary">{timePart}</span>
      <span className="ml-1.5 text-xs text-on-surface-variant/60">{tzAbbr}</span>
    </p>
  );
}
import { useAuth } from "@/context/AuthContext";
import { subscribeSessions, subscribeSubjects } from "@/lib/firebase/firestore";
import { computeStreak, computeLongestStreak, hasPerfectWeek } from "@/lib/streakLogic";
import { getColor } from "@/lib/colorPalette";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
import TasksWidget from "@/components/dashboard/TasksWidget";
import type { HeatmapCell, Session, Subject } from "@/types";

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
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Weekly Study Hours</h2>
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
                      } ${isHover && d.minutes > 0 ? "opacity-100 shadow-[0_0_20px_rgba(124,58,237,0.4)]" : ""}`}
                      style={{ height: `${Math.max(pct, d.minutes > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-inter ${isBest ? "text-secondary font-semibold" : "text-on-surface-variant"}`}>
                    {d.day}
                  </span>
                  {isHover && (
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-10 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] whitespace-nowrap pointer-events-none">
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
  const totalHours = (cells.reduce((s, c) => s + c.minutes, 0) / 60).toFixed(1);

  return (
    <div className="glass-card p-6 flex flex-col gap-4 overflow-hidden relative">
      <div>
        <h2 className="font-grotesk font-bold text-lg text-on-surface">90-Day Velocity</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {totalDays} active days · {totalHours}h total
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
          className="absolute z-20 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)] whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-full"
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
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Active Focus Areas</h2>
        <Link href="/subjects" className="text-sm text-primary hover:opacity-80 transition-opacity">
          View All →
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
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: c.chip, color: c.chipText }}>{s.category}</span>
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
    const header = "Date,Focus Area,Duration (min),Focus Score,Notes";
    const rows = sessions.map((s) =>
      [s.date, `"${s.subjectName}"`, s.durationMinutes, s.focusScore, `"${s.notes ?? ""}"`].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "study-sessions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Recent Sessions</h2>
        <button onClick={handleExport} className="text-sm text-on-surface-variant border border-outline-variant px-3 py-1 rounded-full hover:border-primary hover:text-primary transition-all">
          Export Logs
        </button>
      </div>
      <div className="glass-card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left text-xs uppercase tracking-widest text-on-surface-variant px-4 py-3">Focus Area</th>
              <th className="text-left text-xs uppercase tracking-widest text-on-surface-variant px-4 py-3">Duration</th>
              <th className="text-left text-xs uppercase tracking-widest text-on-surface-variant px-4 py-3">Focus Score</th>
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
  emoji: string;
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
    { id: "first",     emoji: "🎯", label: "First Session",    desc: "Completed your first focus session",    earned: totalSessions >= 1 },
    { id: "streak3",   emoji: "🔥", label: "3-Day Streak",     desc: "3 days of focus in a row",              earned: streak >= 3 },
    { id: "streak7",   emoji: "⚡", label: "Week Warrior",      desc: "7 days of focus in a row",              earned: streak >= 7 },
    { id: "streak30",  emoji: "🏆", label: "Unstoppable",       desc: "30 days of focus in a row",             earned: streak >= 30 },
    { id: "perfectwk", emoji: "🌟", label: "Perfect Week",      desc: "Studied every day this week",           earned: perfectWeek },
    { id: "hours10",   emoji: "⏱️", label: "10 Hours",          desc: "Logged 10 total hours of focus",        earned: totalHours >= 10 },
    { id: "hours50",   emoji: "💫", label: "50 Hours",          desc: "Logged 50 total hours of focus",        earned: totalHours >= 50 },
    { id: "hours100",  emoji: "🚀", label: "100 Hours",         desc: "Logged 100 total hours of focus",       earned: totalHours >= 100 },
    { id: "s10",       emoji: "✨", label: "10 Sessions",       desc: "Completed 10 focus sessions",           earned: totalSessions >= 10 },
    { id: "s50",       emoji: "🎖️", label: "50 Sessions",       desc: "Completed 50 focus sessions",           earned: totalSessions >= 50 },
    { id: "s100",      emoji: "💯", label: "Century",           desc: "100 focus sessions completed",          earned: totalSessions >= 100 },
    { id: "longest7",  emoji: "📈", label: "Best Streak: 7d",   desc: "Longest streak of 7+ days ever",        earned: longest >= 7 },
  ];

  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Badges</h2>
        <span className="text-sm text-on-surface-variant">{earned.length}/{badges.length} earned</span>
      </div>
      <div className="glass-card p-5">
        {earned.length === 0 && (
          <p className="text-on-surface-variant text-sm text-center py-4">
            Complete your first focus session to start earning badges!
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Earned first */}
          {earned.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/8 border border-primary/20 text-center">
              <span className="text-2xl">{b.emoji}</span>
              <span className="font-grotesk font-bold text-xs text-on-surface">{b.label}</span>
              <span className="text-[10px] text-on-surface-variant leading-tight">{b.desc}</span>
            </div>
          ))}
          {/* Locked / not yet earned */}
          {locked.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-container border border-outline-variant/40 text-center opacity-35">
              <span className="text-2xl grayscale">{b.emoji}</span>
              <span className="font-grotesk font-bold text-xs text-on-surface-variant">{b.label}</span>
              <span className="text-[10px] text-on-surface-variant leading-tight">{b.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const greeting = user?.displayName ?? user?.email?.split("@")[0] ?? "Alex";

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
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = localDateStr(weekAgo);
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
      {/* Greeting */}
      <div>
        <h1 className="font-grotesk font-bold text-3xl text-on-surface">Welcome back, {greeting}</h1>
        <LiveClock />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        {/* Streak */}
        <div className="glass-card p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_fire_department
            </span>
          </div>
          <div>
            <div className="font-jetbrains font-semibold text-2xl text-on-surface">{streakDays} {streakDays === 1 ? "Day" : "Day"} Streak</div>
            <div className="text-xs uppercase tracking-widest text-on-surface-variant mt-1">Consistency King</div>
          </div>
        </div>

        {/* Weekly Hours */}
        <div className="glass-card p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary">schedule</span>
          </div>
          <div>
            <div className="font-jetbrains font-semibold text-2xl text-on-surface">
              {formatSmartDuration(Math.round(weeklyHours * 60))}
            </div>
            <div className="text-xs uppercase tracking-widest text-on-surface-variant mt-1">Weekly Effort</div>
          </div>
        </div>

        {/* Daily Avg */}
        <div className="glass-card p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-tertiary">insights</span>
          </div>
          <div>
            <div className="font-jetbrains font-semibold text-2xl text-on-surface">
              {formatSmartDuration(Math.round(dailyAvg * 60))}
            </div>
            <div className="text-xs uppercase tracking-widest text-secondary mt-1">Daily Average</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeeklyBarChart sessions={sessions} />
        </div>
        <div>
          <Heatmap sessions={sessions} />
        </div>
      </div>

      {/* Tasks Widget */}
      <TasksWidget />

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
