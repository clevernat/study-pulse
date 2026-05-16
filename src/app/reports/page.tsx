"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeSessions } from "@/lib/firebase/firestore";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
import type { Session } from "@/types";

type Period = "This Week" | "This Month" | "Last 3 Months";

const PERIODS: Period[] = ["This Week", "This Month", "Last 3 Months"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_COLS = 7;
const SUBJECT_COLORS = ["#d2bbff", "#40efb7", "#ffb95f", "#7c3aed", "#958da1", "#f472b6", "#60a5fa"];

const EmptyState = ({ msg = "No data yet — start logging sessions!" }: { msg?: string }) => (
  <div className="text-center text-[#958da1] font-inter py-8 text-sm">{msg}</div>
);

// ── helpers ──────────────────────────────────────────────────────────────────
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
function getWeekKey(date: Date): string {
  return `${date.getFullYear()}-W${getISOWeek(date).toString().padStart(2, "0")}`;
}
function filterSessionsByPeriod(sessions: Session[], period: Period): Session[] {
  const now = new Date();
  let cutoffStr: string;
  if (period === "This Week") {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    cutoffStr = localDateStr(monday);
  } else if (period === "This Month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    cutoffStr = localDateStr(first);
  } else {
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    cutoffStr = localDateStr(threeMonthsAgo);
  }
  return sessions.filter((s) => s.date >= cutoffStr);
}

// Parse "HH:MM" into a minute count past midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activePeriod, setActivePeriod] = useState<Period>("This Week");
  const { user } = useAuth();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeSessions(user.uid, (data) => {
      setAllSessions(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const sessions = useMemo(
    () => filterSessionsByPeriod(allSessions, activePeriod),
    [allSessions, activePeriod]
  );

  // ── Top Stats ────────────────────────────────────────────────────────────────
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const sessionCount = sessions.length;
  const avgFocusScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length)
      : 0;

  const subjectMinutes: Record<string, { name: string; minutes: number }> = {};
  for (const s of sessions) {
    if (!subjectMinutes[s.subjectId]) subjectMinutes[s.subjectId] = { name: s.subjectName, minutes: 0 };
    subjectMinutes[s.subjectId].minutes += s.durationMinutes;
  }
  const bestSubjectEntry = Object.values(subjectMinutes).sort((a, b) => b.minutes - a.minutes)[0];
  const bestSubject = bestSubjectEntry
    ? { name: bestSubjectEntry.name, label: formatSmartDuration(bestSubjectEntry.minutes) }
    : null;

  // ── Insights ─────────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (sessions.length === 0) return null;

    // Most productive day-of-week
    const minutesByDow = Array(7).fill(0);
    const countByDow = Array(7).fill(0);
    for (const s of sessions) {
      const dow = new Date(s.date + "T12:00:00").getDay();
      const idx = dow === 0 ? 6 : dow - 1;
      minutesByDow[idx] += s.durationMinutes;
      countByDow[idx]++;
    }
    const bestDowIdx = minutesByDow.indexOf(Math.max(...minutesByDow));
    const bestDow = { day: DAYS[bestDowIdx], minutes: minutesByDow[bestDowIdx], count: countByDow[bestDowIdx] };

    // Time of day buckets (Morning 5-12, Afternoon 12-17, Evening 17-21, Night 21-5)
    const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 } as Record<string, number>;
    const focusByBucket = { Morning: [] as number[], Afternoon: [] as number[], Evening: [] as number[], Night: [] as number[] };
    for (const s of sessions) {
      const m = timeToMinutes(s.startTime);
      const bucket =
        m >= 5 * 60 && m < 12 * 60 ? "Morning" :
        m >= 12 * 60 && m < 17 * 60 ? "Afternoon" :
        m >= 17 * 60 && m < 21 * 60 ? "Evening" : "Night";
      buckets[bucket] += s.durationMinutes;
      focusByBucket[bucket as keyof typeof focusByBucket].push(s.focusScore);
    }
    const topBucket = (Object.entries(buckets) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    const bestFocusBucketEntry = (Object.entries(focusByBucket) as [string, number[]][])
      .filter(([, arr]) => arr.length > 0)
      .map(([k, arr]) => ({ bucket: k, avg: arr.reduce((s, x) => s + x, 0) / arr.length }))
      .sort((a, b) => b.avg - a.avg)[0];

    // Average session length
    const avgSessionMin = Math.round(totalMinutes / sessions.length);

    // Consistency: unique days studied / period length in days
    const uniqueDays = new Set(sessions.map((s) => s.date)).size;

    return { bestDow, topBucket, bestFocusBucket: bestFocusBucketEntry, avgSessionMin, uniqueDays };
  }, [sessions, totalMinutes]);

  // ── Weekly trend (last 8 weeks) ───────────────────────────────────────────
  const weeklyHours = useMemo(() => {
    const now = new Date();
    const weeks: { key: string; label: string; weekStart: string; hours: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      // Find Monday of that week
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + 1);
      weeks.push({
        key: getWeekKey(d),
        label: `W${8 - i}`,
        weekStart: monday.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        hours: 0,
      });
    }
    for (const s of allSessions) {
      const key = getWeekKey(new Date(s.date + "T12:00:00"));
      const w = weeks.find((x) => x.key === key);
      if (w) w.hours += s.durationMinutes / 60;
    }
    return weeks;
  }, [allSessions]);

  const hasWeeklyData = weeklyHours.some((w) => w.hours > 0);
  const chartWidth = 380;
  const chartHeight = 120;
  const maxWeeklyVal = Math.max(...weeklyHours.map((w) => w.hours), 1);
  const stepX = chartWidth / (weeklyHours.length - 1);
  const weeklyPoints = weeklyHours.map((w, i) => ({
    x: i * stepX,
    y: chartHeight - (w.hours / maxWeeklyVal) * chartHeight,
  }));
  const areaPoints =
    `${weeklyPoints[0]?.x ?? 0},${chartHeight} ` +
    weeklyPoints.map((p) => `${p.x},${p.y}`).join(" ") +
    ` ${weeklyPoints[weeklyPoints.length - 1]?.x ?? 0},${chartHeight}`;

  const [weeklyHover, setWeeklyHover] = useState<number | null>(null);

  // ── Subject distribution donut ────────────────────────────────────────────
  const donutSubjects = useMemo(() => {
    const entries = Object.values(subjectMinutes).sort((a, b) => b.minutes - a.minutes);
    if (entries.length === 0) return [];
    const total = entries.reduce((s, e) => s + e.minutes, 0);
    return entries.slice(0, 5).map((e, i) => ({
      name: e.name,
      minutes: e.minutes,
      percentage: Math.round((e.minutes / total) * 100),
      color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
    }));
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const donutArcs = useMemo(() => {
    const circumference = 2 * Math.PI * 60;
    let offset = 0;
    return donutSubjects.map((subject) => {
      const dash = (subject.percentage / 100) * circumference;
      const arc = { ...subject, dash, offset: circumference - offset };
      offset += dash;
      return arc;
    });
  }, [donutSubjects]);

  const [donutHover, setDonutHover] = useState<number | null>(null);

  // ── Heatmap (7×7) ─────────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const now = new Date();
    const dateMap: Record<string, number> = {};
    for (const s of allSessions) {
      dateMap[s.date] = (dateMap[s.date] ?? 0) + s.durationMinutes;
    }
    const dayOfWeek = now.getDay() || 7;
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - dayOfWeek + 7);
    lastSunday.setHours(0, 0, 0, 0);

    const grid: { intensity: number; minutes: number; date: string }[][] = Array.from({ length: 7 }, () =>
      Array(HEATMAP_COLS).fill(0).map(() => ({ intensity: 0, minutes: 0, date: "" }))
    );

    for (let col = 0; col < HEATMAP_COLS; col++) {
      for (let row = 0; row < 7; row++) {
        const daysBack = (HEATMAP_COLS - 1 - col) * 7 + (6 - row);
        const d = new Date(lastSunday);
        d.setDate(lastSunday.getDate() - daysBack);
        const key = localDateStr(d);
        grid[row][col] = { intensity: 0, minutes: dateMap[key] ?? 0, date: key };
      }
    }

    const allNonZero = grid.flat().map((c) => c.minutes).filter((v) => v > 0).sort((a, b) => a - b);
    const q1 = allNonZero[Math.floor(allNonZero.length * 0.25)] ?? 30;
    const q2 = allNonZero[Math.floor(allNonZero.length * 0.5)] ?? 60;
    const q3 = allNonZero[Math.floor(allNonZero.length * 0.75)] ?? 90;

    grid.forEach((row) =>
      row.forEach((cell) => {
        cell.intensity =
          cell.minutes === 0 ? 0 :
          cell.minutes <= q1 ? 1 :
          cell.minutes <= q2 ? 2 :
          cell.minutes <= q3 ? 3 : 4;
      })
    );
    return grid;
  }, [allSessions]);

  const hasHeatmapData = heatmapData.flat().some((c) => c.minutes > 0);
  const [heatHover, setHeatHover] = useState<{ row: number; col: number } | null>(null);

  // ── Focus score by day ────────────────────────────────────────────────────
  const focusByDay = useMemo(() => {
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const s of sessions) {
      const dow = new Date(s.date + "T12:00:00").getDay();
      const idx = dow === 0 ? 6 : dow - 1;
      sums[idx] += s.focusScore;
      counts[idx]++;
    }
    return sums.map((sum, i) => ({
      score: counts[i] > 0 ? Math.round(sum / counts[i]) : 0,
      count: counts[i],
    }));
  }, [sessions]);

  const hasFocusData = focusByDay.some((d) => d.score > 0);
  const [focusHover, setFocusHover] = useState<number | null>(null);

  const barMax = 100;
  const barChartHeight = 120;
  const barWidth = 32;
  const barGap = 12;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-space text-2xl font-bold text-[#e8e8f0]">Reports &amp; Analytics</h1>
          <p className="text-sm text-[#958da1] mt-1">Track your learning performance over time</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activePeriod === period
                  ? "bg-[#7c3aed]/20 text-[#d2bbff] border border-[#d2bbff]/30"
                  : "text-[#958da1] border border-[#252535] hover:text-[#e8e8f0]"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#958da1]">Total Study Time</p>
          <p className="font-jetbrains text-3xl font-bold text-[#e8e8f0]">
            {loading ? "—" : formatSmartDuration(totalMinutes)}
          </p>
          <p className="text-sm text-secondary">All logged sessions</p>
        </div>
        <div className="glass-card p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#958da1]">Sessions Completed</p>
          <p className="font-jetbrains text-3xl font-bold text-[#e8e8f0]">
            {loading ? "—" : sessionCount}
          </p>
          <p className="text-sm text-secondary">This period</p>
        </div>
        <div className="glass-card p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#958da1]">Avg Focus Score</p>
          <p className="font-jetbrains text-3xl font-bold text-[#e8e8f0]">
            {loading ? "—" : sessions.length > 0 ? `${avgFocusScore}%` : "—"}
          </p>
          <p className="text-sm text-secondary">
            {avgFocusScore >= 90 ? "Excellent" : avgFocusScore >= 75 ? "Good" : sessions.length > 0 ? "Keep going" : "No data yet"}
          </p>
        </div>
        <div className="glass-card p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#958da1]">Best Subject</p>
          <p className="font-jetbrains text-3xl font-bold text-[#e8e8f0] truncate">
            {loading ? "—" : bestSubject ? bestSubject.name : "—"}
          </p>
          <p className="text-sm text-primary">{bestSubject ? `${bestSubject.label} logged` : "No sessions yet"}</p>
        </div>
      </div>

      {/* Insights row */}
      {insights && (
        <div>
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-3 text-lg">Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#958da1] mb-2">
                <span className="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
                Most productive day
              </div>
              <div className="font-grotesk text-xl font-bold text-on-surface">{insights.bestDow.day}</div>
              <div className="text-xs text-on-surface-variant mt-1">
                {insights.bestDow.minutes} min across {insights.bestDow.count} session{insights.bestDow.count === 1 ? "" : "s"}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#958da1] mb-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">schedule</span>
                Top time of day
              </div>
              <div className="font-grotesk text-xl font-bold text-on-surface">{insights.topBucket[0]}</div>
              <div className="text-xs text-on-surface-variant mt-1">
                {insights.topBucket[1]} min total
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#958da1] mb-2">
                <span className="material-symbols-outlined text-[16px] text-tertiary">psychology</span>
                Sharpest focus
              </div>
              <div className="font-grotesk text-xl font-bold text-on-surface">
                {insights.bestFocusBucket ? insights.bestFocusBucket.bucket : "—"}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {insights.bestFocusBucket ? `${Math.round(insights.bestFocusBucket.avg)}% avg score` : ""}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#958da1] mb-2">
                <span className="material-symbols-outlined text-[16px] text-primary">timelapse</span>
                Average session
              </div>
              <div className="font-grotesk text-xl font-bold text-on-surface">{insights.avgSessionMin} min</div>
              <div className="text-xs text-on-surface-variant mt-1">
                across {insights.uniqueDays} day{insights.uniqueDays === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Trend */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-space font-semibold text-[#e8e8f0]">Weekly Learning Trend</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Hours per week · last 8 weeks · hover a point</p>
            </div>
          </div>
          {!hasWeeklyData ? (
            <EmptyState />
          ) : (
            <div className="relative">
              <svg viewBox="0 0 400 150" className="w-full" preserveAspectRatio="none" style={{ height: 180 }}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="1" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3].map((i) => {
                  const y = 10 + (i * chartHeight) / 3;
                  return <line key={i} x1="10" y1={y} x2="390" y2={y} stroke="#252535" strokeWidth="1" />;
                })}
                <polygon
                  points={areaPoints
                    .split(" ")
                    .map((pt) => {
                      const [x, y] = pt.split(",");
                      return `${parseFloat(x) + 10},${parseFloat(y) + 10}`;
                    })
                    .join(" ")}
                  fill="url(#lineGrad)"
                  opacity="0.15"
                />
                <polyline
                  points={weeklyPoints.map((p) => `${p.x + 10},${p.y + 10}`).join(" ")}
                  stroke="#d2bbff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {weeklyPoints.map((p, i) => (
                  <g
                    key={i}
                    onMouseEnter={() => setWeeklyHover(i)}
                    onMouseLeave={() => setWeeklyHover(null)}
                  >
                    <circle cx={p.x + 10} cy={p.y + 10} r={weeklyHover === i ? 6 : 3} fill="#d2bbff" />
                    {/* invisible hit box */}
                    <circle cx={p.x + 10} cy={p.y + 10} r={18} fill="transparent" />
                  </g>
                ))}
                {weeklyHours.map((w, i) => (
                  <text key={i} x={i * stepX + 10} y={148} textAnchor="middle" fontSize="10" fill="#958da1" fontFamily="monospace">
                    {w.label}
                  </text>
                ))}
              </svg>
              {weeklyHover !== null && (
                <div
                  className="absolute z-10 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-full"
                  style={{
                    left: `${((weeklyPoints[weeklyHover].x + 10) / 400) * 100}%`,
                    top: `${((weeklyPoints[weeklyHover].y + 10) / 150) * 100}%`,
                    marginTop: -8,
                  }}
                >
                  <div className="text-[10px] text-on-surface-variant">Week of {weeklyHours[weeklyHover].weekStart}</div>
                  <div className="text-sm font-jetbrains font-semibold text-on-surface">
                    {weeklyHours[weeklyHover].hours.toFixed(1)}h
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Donut */}
        <div className="glass-card p-6">
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">Subject Distribution</h2>
          {donutSubjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 160 160" className="w-36 h-36" aria-label="Subject distribution">
                {donutArcs.map((arc, i) => (
                  <circle
                    key={i}
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={donutHover === i ? 24 : 20}
                    strokeDasharray={`${arc.dash} ${2 * Math.PI * 60 - arc.dash}`}
                    strokeDashoffset={arc.offset}
                    transform="rotate(-90 80 80)"
                    onMouseEnter={() => setDonutHover(i)}
                    onMouseLeave={() => setDonutHover(null)}
                    style={{ cursor: "pointer", transition: "stroke-width 150ms" }}
                  />
                ))}
                <text x="80" y="76" textAnchor="middle" fontSize="11" fill="#e8e8f0" fontFamily="monospace" fontWeight="bold">
                  {donutHover !== null ? `${donutSubjects[donutHover].percentage}%` : donutSubjects.length}
                </text>
                <text x="80" y="90" textAnchor="middle" fontSize="9" fill="#958da1" fontFamily="monospace">
                  {donutHover !== null ? "share" : "Subjects"}
                </text>
              </svg>
              <div className="mt-4 space-y-2 w-full">
                {donutSubjects.map((subject, i) => (
                  <div
                    key={subject.name}
                    onMouseEnter={() => setDonutHover(i)}
                    onMouseLeave={() => setDonutHover(null)}
                    className={`flex items-center justify-between cursor-pointer transition-all rounded px-1 py-0.5 ${
                      donutHover === i ? "bg-surface-container/50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                      <span className="text-xs text-[#c4c4d4] truncate max-w-[120px]">{subject.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-on-surface-variant font-jetbrains">{formatSmartDuration(subject.minutes)}</span>
                      <span className="text-xs font-jetbrains text-[#958da1] w-9 text-right">{subject.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heatmap */}
        <div className="glass-card p-6 relative">
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-1">Study Time Heatmap</h2>
          <p className="text-xs text-on-surface-variant mb-4">Last 7 weeks · hover a cell</p>
          {!hasHeatmapData ? (
            <EmptyState />
          ) : (
            <>
              <div className="space-y-1.5">
                {HEATMAP_DAYS.map((day, row) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs text-[#958da1] w-8 font-jetbrains flex-shrink-0">{day}</span>
                    <div className="flex gap-1 flex-1">
                      {heatmapData[row].map((cell, col) => {
                        const opacities = ["opacity-5", "opacity-25", "opacity-45", "opacity-65", "opacity-90"];
                        return (
                          <div
                            key={col}
                            onMouseEnter={() => setHeatHover({ row, col })}
                            onMouseLeave={() => setHeatHover(null)}
                            className={`flex-1 aspect-square rounded-sm bg-secondary ${opacities[cell.intensity]} hover:ring-2 hover:ring-primary/50 cursor-pointer transition-all`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-[#958da1]">Less</span>
                {[5, 25, 45, 65, 90].map((op) => (
                  <div key={op} className="w-3 h-3 rounded-sm bg-secondary" style={{ opacity: op / 100 }} />
                ))}
                <span className="text-xs text-[#958da1]">More</span>
              </div>
              {heatHover !== null && (() => {
                const cell = heatmapData[heatHover.row][heatHover.col];
                return (
                  <div className="absolute top-4 right-4 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] pointer-events-none">
                    <div className="text-[10px] text-on-surface-variant">
                      {new Date(cell.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs font-jetbrains font-semibold text-on-surface">
                      {cell.minutes === 0 ? "No study" : `${cell.minutes} min`}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Focus Score by Day */}
        <div className="glass-card p-6 relative">
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-1">Focus Score by Day</h2>
          <p className="text-xs text-on-surface-variant mb-4">Avg focus % per weekday · hover a bar</p>
          {!hasFocusData ? (
            <EmptyState />
          ) : (
            <svg
              viewBox={`0 0 ${(barWidth + barGap) * 7 + 40} 160`}
              className="w-full"
              style={{ height: 200 }}
            >
              {[0, 50, 100].map((val) => {
                const y = 10 + barChartHeight - (val / barMax) * barChartHeight;
                return (
                  <g key={val}>
                    <line x1="30" y1={y} x2={(barWidth + barGap) * 7 + 40} y2={y} stroke="#252535" strokeWidth="1" />
                    <text x="26" y={y + 4} textAnchor="end" fontSize="9" fill="#958da1" fontFamily="monospace">{val}%</text>
                  </g>
                );
              })}
              {focusByDay.map((d, i) => {
                const score = d.score;
                const barHeight = (score / barMax) * barChartHeight;
                const x = 34 + i * (barWidth + barGap);
                const y = 10 + barChartHeight - barHeight;
                const color =
                  score === 0 ? "#252535" :
                  score >= 90 ? "#40efb7" :
                  score >= 80 ? "#d2bbff" : "#ffb95f";
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setFocusHover(i)}
                    onMouseLeave={() => setFocusHover(null)}
                    style={{ cursor: score > 0 ? "pointer" : "default" }}
                  >
                    {score > 0 && (
                      <>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx="4"
                          fill={color}
                          fillOpacity={focusHover === i ? "1" : "0.85"}
                        />
                        <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#e8e8f0" fontFamily="monospace">
                          {score}
                        </text>
                      </>
                    )}
                    {/* invisible hit area covering full column */}
                    <rect x={x - 2} y={10} width={barWidth + 4} height={barChartHeight} fill="transparent" />
                    <text x={x + barWidth / 2} y={148} textAnchor="middle" fontSize="9" fill="#958da1" fontFamily="monospace">
                      {DAYS[i]}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          {focusHover !== null && focusByDay[focusHover].score > 0 && (
            <div className="absolute top-4 right-4 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] pointer-events-none">
              <div className="text-[10px] text-on-surface-variant">{DAYS[focusHover]}</div>
              <div className="text-xs font-jetbrains font-semibold text-on-surface">
                {focusByDay[focusHover].score}% focus · {focusByDay[focusHover].count} session{focusByDay[focusHover].count === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
