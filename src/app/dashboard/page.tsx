"use client";

import { useEffect, useState } from "react";
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
import { computeStreak } from "@/lib/streakLogic";
import { getColor } from "@/lib/colorPalette";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
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
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return localDateStr(d);   // local date, not UTC
  });

  const dayTotals = days.map((dateStr) => {
    const total = sessions
      .filter((s) => s.date === dateStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    // append noon to prevent any timezone shift when parsing for display
    const dayLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
    return { day: dayLabel, minutes: total, dateStr };
  });

  const maxMinutes = Math.max(...dayTotals.map((d) => d.minutes), 1);

  return (
    <div className="glass-card p-6 flex flex-col gap-4">
      <h2 className="font-grotesk font-bold text-lg text-on-surface">Weekly Study Hours</h2>
      <div className="flex items-end justify-between h-48 gap-2">
        {dayTotals.map((d) => {
          const isBest = d.minutes === maxMinutes && maxMinutes > 0;
          const pct = (d.minutes / maxMinutes) * 100;
          return (
            <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end" style={{ height: "160px" }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${isBest ? "bg-secondary" : "bg-primary/60"}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-inter ${isBest ? "text-secondary font-semibold" : "text-on-surface-variant"}`}>
                {d.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ sessions }: { sessions: Session[] }) {
  const cells = buildHeatmap(sessions);
  return (
    <div className="glass-card p-6 flex flex-col gap-4 overflow-hidden">
      <h2 className="font-grotesk font-bold text-lg text-on-surface">90-Day Velocity</h2>
      <div className="overflow-x-auto">
      <div className="grid gap-1 min-w-[260px]" style={{ gridTemplateColumns: "repeat(13, 1fr)" }}>
        {cells.map((cell) => (
          <div
            key={cell.date}
            title={`${cell.date}: ${cell.minutes}m`}
            className={`w-full aspect-square rounded-sm ${heatIntensityClass(cell.intensity)}`}
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
    </div>
  );
}

// ── Active Subjects ───────────────────────────────────────────────────────────

function ActiveSubjects({ subjects }: { subjects: Subject[] }) {
  const displayed = subjects.slice(0, 3);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Active Subjects</h2>
        <Link href="/subjects" className="text-sm text-primary hover:opacity-80 transition-opacity">
          View All →
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {displayed.map((s) => {
          const c = getColor(s.color);
          const hoursThisMonth = formatSmartDuration(s.totalMinutes);
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
                <span className="text-xs text-on-surface-variant">{hoursThisMonth} total</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recent Sessions ───────────────────────────────────────────────────────────

function RecentSessions({ sessions }: { sessions: Session[] }) {
  const displayed = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  function handleExport() {
    const header = "Date,Subject,Duration (min),Focus Score,Notes";
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
              <th className="text-left text-xs uppercase tracking-widest text-on-surface-variant px-4 py-3">Subject</th>
              <th className="text-left text-xs uppercase tracking-widest text-on-surface-variant px-4 py-3">Duration</th>
              <th className="text-left text-xs uppercase tracking-widest text-on-surface-variant px-4 py-3">Focus Score</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((session: Session) => (
              <tr key={session.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container/30 transition-colors">
                <td className="px-4 py-3 text-sm text-on-surface font-inter">{session.subjectName}</td>
                <td className="px-4 py-3 text-sm font-jetbrains text-on-surface-variant">
                  {formatDuration(session.durationMinutes)}
                </td>
                <td className={`px-4 py-3 text-sm font-jetbrains font-semibold ${focusColor(session.focusScore)}`}>
                  {session.focusScore}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <ActiveSubjects subjects={subjects} />
        <RecentSessions sessions={sessions} />
      </div>
    </div>
  );
}
