"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeSessions, subscribeSubjects } from "@/lib/firebase/firestore";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import type { Session, Subject } from "@/types";

type Period = "This Week" | "This Month" | "Last 3 Months";

const PERIODS: Period[] = ["This Week", "This Month", "Last 3 Months"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_COLS = 7;

const EmptyState = ({ msg = "No data yet — start logging sessions!" }: { msg?: string }) => (
  <div className="text-center text-on-surface-variant font-inter py-8 text-sm">{msg}</div>
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
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activePeriod, setActivePeriod] = useState<Period>("This Week");
  const { user } = useAuth();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub1 = subscribeSessions(user.uid, (data) => {
      setAllSessions(data);
      setLoading(false);
    });
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Build subject lookup so renames reflect everywhere without needing to
  // backfill the denormalized subjectName / subjectColor on session docs.
  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);

  const sessions = useMemo(
    () => filterSessionsByPeriod(allSessions, activePeriod),
    [allSessions, activePeriod]
  );

  // ── Top Stats ────────────────────────────────────────────────────────────────
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const sessionCount = sessions.length;
  const avgFocusScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length)
    : 0;

  // Aggregate by subjectId for distribution + best-subject
  const subjectAgg = useMemo(() => {
    const m: Record<string, { id: string; minutes: number; focusSum: number; count: number }> = {};
    for (const s of sessions) {
      if (!m[s.subjectId]) m[s.subjectId] = { id: s.subjectId, minutes: 0, focusSum: 0, count: 0 };
      m[s.subjectId].minutes += s.durationMinutes;
      m[s.subjectId].focusSum += s.focusScore;
      m[s.subjectId].count += 1;
    }
    return Object.values(m).sort((a, b) => b.minutes - a.minutes);
  }, [sessions]);

  const bestSubjectEntry = subjectAgg[0];
  const bestSubject = bestSubjectEntry ? {
    name: subjectById.get(bestSubjectEntry.id)?.name ?? "—",
    label: formatSmartDuration(bestSubjectEntry.minutes),
  } : null;

  // ── Insights ─────────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (sessions.length === 0) return null;
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

    const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 } as Record<string, number>;
    const focusByBucket = { Morning: [] as number[], Afternoon: [] as number[], Evening: [] as number[], Night: [] as number[] };
    for (const s of sessions) {
      const m = timeToMinutes(s.startTime);
      const bucket = m >= 5 * 60 && m < 12 * 60 ? "Morning" : m >= 12 * 60 && m < 17 * 60 ? "Afternoon" : m >= 17 * 60 && m < 21 * 60 ? "Evening" : "Night";
      buckets[bucket] += s.durationMinutes;
      focusByBucket[bucket as keyof typeof focusByBucket].push(s.focusScore);
    }
    const topBucket = (Object.entries(buckets) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    const bestFocusBucket = (Object.entries(focusByBucket) as [string, number[]][])
      .filter(([, arr]) => arr.length > 0)
      .map(([k, arr]) => ({ bucket: k, avg: arr.reduce((s, x) => s + x, 0) / arr.length }))
      .sort((a, b) => b.avg - a.avg)[0];

    const avgSessionMin = Math.round(totalMinutes / sessions.length);
    const uniqueDays = new Set(sessions.map((s) => s.date)).size;
    return { bestDow, topBucket, bestFocusBucket, avgSessionMin, uniqueDays };
  }, [sessions, totalMinutes]);

  // ── Weekly trend (last 8 weeks) ───────────────────────────────────────────
  const weeklyHours = useMemo(() => {
    const now = new Date();
    const weeks: { key: string; label: string; weekStart: string; hours: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
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
  const maxWeeklyVal = Math.max(...weeklyHours.map((w) => w.hours), 1);
  // SVG natural coordinates — letting the SVG scale uniformly to fit
  const W = 400;
  const H = 180;
  const padL = 36, padR = 10, padT = 14, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = innerW / (weeklyHours.length - 1);
  const weeklyPoints = weeklyHours.map((w, i) => ({
    x: padL + i * stepX,
    y: padT + (1 - w.hours / maxWeeklyVal) * innerH,
  }));
  const areaPoints = `${padL},${padT + innerH} ` +
    weeklyPoints.map((p) => `${p.x},${p.y}`).join(" ") +
    ` ${padL + innerW},${padT + innerH}`;
  const yTicks = [0, 1, 2, 3].map((i) => ({
    val: Math.round(maxWeeklyVal * (1 - i / 3) * 10) / 10,
    y: padT + (i / 3) * innerH,
  }));
  const [weeklyHover, setWeeklyHover] = useState<number | null>(null);

  // ── Subject distribution donut ────────────────────────────────────────────
  const donutSubjects = useMemo(() => {
    if (subjectAgg.length === 0) return [];
    const total = subjectAgg.reduce((s, e) => s + e.minutes, 0);
    return subjectAgg.slice(0, 6).map((e) => {
      const sub = subjectById.get(e.id);
      return {
        id: e.id,
        name: sub?.name ?? "—",
        minutes: e.minutes,
        percentage: Math.round((e.minutes / total) * 100),
        color: getColor(sub?.color ?? "violet").dot,
      };
    });
  }, [subjectAgg, subjectById]);

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

  // ── Hour-of-day distribution (NEW) ─────────────────────────────────────────
  const hourOfDay = useMemo(() => {
    const buckets = Array(24).fill(0);
    for (const s of sessions) {
      const h = Math.floor(timeToMinutes(s.startTime) / 60);
      if (h >= 0 && h < 24) buckets[h] += s.durationMinutes;
    }
    return buckets;
  }, [sessions]);
  const hourMax = Math.max(...hourOfDay, 1);
  const hasHourData = hourOfDay.some((v) => v > 0);
  const [hourHover, setHourHover] = useState<number | null>(null);

  // ── Compact 7×7 heatmap ─────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const now = new Date();
    const dateMap: Record<string, number> = {};
    for (const s of allSessions) dateMap[s.date] = (dateMap[s.date] ?? 0) + s.durationMinutes;
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
        cell.intensity = cell.minutes === 0 ? 0 :
          cell.minutes <= q1 ? 1 :
          cell.minutes <= q2 ? 2 :
          cell.minutes <= q3 ? 3 : 4;
      })
    );
    return grid;
  }, [allSessions]);

  const hasHeatmapData = heatmapData.flat().some((c) => c.minutes > 0);
  const [heatHover, setHeatHover] = useState<{ row: number; col: number } | null>(null);

  // ── Focus score by day of week ────────────────────────────────────────────
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

  // ── Subject focus comparison (NEW) ─────────────────────────────────────────
  const subjectFocus = useMemo(() => {
    return subjectAgg
      .map((e) => {
        const sub = subjectById.get(e.id);
        return {
          id: e.id,
          name: sub?.name ?? "—",
          color: getColor(sub?.color ?? "violet").dot,
          avgFocus: e.count > 0 ? Math.round(e.focusSum / e.count) : 0,
          minutes: e.minutes,
        };
      })
      .sort((a, b) => b.avgFocus - a.avgFocus)
      .slice(0, 6);
  }, [subjectAgg, subjectById]);

  const hasSubjectFocus = subjectFocus.length > 0;

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-grotesk text-3xl font-bold text-on-surface">Reports &amp; Analytics</h1>
          <p className="text-sm text-on-surface-variant mt-1">Track your learning performance over time</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activePeriod === period
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "text-on-surface-variant border border-outline-variant hover:text-on-surface hover:border-outline"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Study Time" value={loading ? "—" : formatSmartDuration(totalMinutes)} hint="All logged sessions" />
        <StatCard label="Sessions" value={loading ? "—" : String(sessionCount)} hint="This period" />
        <StatCard label="Avg Focus" value={loading ? "—" : sessions.length > 0 ? `${avgFocusScore}%` : "—"} hint={avgFocusScore >= 90 ? "Excellent" : avgFocusScore >= 75 ? "Good" : sessions.length > 0 ? "Keep going" : "No data"} accent />
        <StatCard label="Best Subject" value={loading ? "—" : bestSubject ? bestSubject.name : "—"} hint={bestSubject ? `${bestSubject.label} logged` : "No sessions yet"} />
      </div>

      {/* Insights */}
      {insights && (
        <div>
          <h2 className="font-grotesk font-bold text-on-surface mb-3 text-base uppercase tracking-widest text-on-surface-variant">Insights</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <InsightCard icon="calendar_today" iconClass="text-primary" label="Most productive day" value={insights.bestDow.day} sub={`${insights.bestDow.minutes} min · ${insights.bestDow.count} session${insights.bestDow.count === 1 ? "" : "s"}`} />
            <InsightCard icon="schedule" iconClass="text-secondary" label="Top time of day" value={insights.topBucket[0]} sub={`${insights.topBucket[1]} min total`} />
            <InsightCard icon="psychology" iconClass="text-tertiary" label="Sharpest focus" value={insights.bestFocusBucket?.bucket ?? "—"} sub={insights.bestFocusBucket ? `${Math.round(insights.bestFocusBucket.avg)}% avg` : ""} />
            <InsightCard icon="timelapse" iconClass="text-primary" label="Avg session" value={`${insights.avgSessionMin} min`} sub={`across ${insights.uniqueDays} day${insights.uniqueDays === 1 ? "" : "s"}`} />
          </div>
        </div>
      )}

      {/* Row 1: Weekly Trend (2/3) + Donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="mb-4">
            <h2 className="font-grotesk font-bold text-on-surface">Weekly Learning Trend</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Hours per week · last 8 weeks · hover a point</p>
          </div>
          {!hasWeeklyData ? <EmptyState /> : (
            <div className="relative">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" aria-label="Weekly learning trend">
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="1" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Y gridlines + labels */}
                {yTicks.map((t, i) => (
                  <g key={i}>
                    <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#252535" strokeWidth="1" />
                    <text x={padL - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="#958da1" fontFamily="monospace">{t.val}h</text>
                  </g>
                ))}
                <polygon points={areaPoints} fill="url(#lineGrad)" opacity="0.25" />
                <polyline
                  points={weeklyPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  stroke="#d2bbff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {weeklyPoints.map((p, i) => (
                  <g key={i} onMouseEnter={() => setWeeklyHover(i)} onMouseLeave={() => setWeeklyHover(null)} style={{ cursor: "pointer" }}>
                    <circle cx={p.x} cy={p.y} r={weeklyHover === i ? 6 : 3.5} fill="#d2bbff" />
                    <circle cx={p.x} cy={p.y} r={20} fill="transparent" />
                  </g>
                ))}
                {weeklyHours.map((w, i) => (
                  <text key={i} x={padL + i * stepX} y={H - 8} textAnchor="middle" fontSize="10" fill="#958da1" fontFamily="monospace">{w.label}</text>
                ))}
              </svg>
              {weeklyHover !== null && (
                <div
                  className="absolute z-10 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-full"
                  style={{ left: `${(weeklyPoints[weeklyHover].x / W) * 100}%`, top: `${(weeklyPoints[weeklyHover].y / H) * 100}%`, marginTop: -8 }}
                >
                  <div className="text-[10px] text-on-surface-variant">Week of {weeklyHours[weeklyHover].weekStart}</div>
                  <div className="text-sm font-jetbrains font-semibold text-on-surface">{weeklyHours[weeklyHover].hours.toFixed(1)}h</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Donut */}
        <div className="glass-card p-6">
          <h2 className="font-grotesk font-bold text-on-surface mb-1">Subject Distribution</h2>
          <p className="text-xs text-on-surface-variant mb-4">Time per subject · hover to inspect</p>
          {donutSubjects.length === 0 ? <EmptyState /> : (
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 160 160" className="w-36 h-36" aria-label="Subject distribution">
                {donutArcs.map((arc, i) => (
                  <circle
                    key={i}
                    cx="80" cy="80" r="60" fill="none"
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
                <text x="80" y="76" textAnchor="middle" fontSize="13" fill="#e8e8f0" fontFamily="monospace" fontWeight="bold">
                  {donutHover !== null ? `${donutSubjects[donutHover].percentage}%` : donutSubjects.length}
                </text>
                <text x="80" y="92" textAnchor="middle" fontSize="9" fill="#958da1" fontFamily="monospace">
                  {donutHover !== null ? donutSubjects[donutHover].name : donutSubjects.length === 1 ? "Subject" : "Subjects"}
                </text>
              </svg>
              <div className="mt-4 space-y-1.5 w-full">
                {donutSubjects.map((subject, i) => (
                  <div
                    key={subject.id}
                    onMouseEnter={() => setDonutHover(i)}
                    onMouseLeave={() => setDonutHover(null)}
                    className={`flex items-center justify-between cursor-pointer rounded px-2 py-1 transition-all ${donutHover === i ? "bg-surface-container/50" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                      <span className="text-xs text-on-surface truncate">{subject.name}</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-jetbrains flex-shrink-0">{subject.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Hour-of-Day + Focus by Day */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hour of Day */}
        <div className="glass-card p-6 relative">
          <h2 className="font-grotesk font-bold text-on-surface mb-1">Hour of Day</h2>
          <p className="text-xs text-on-surface-variant mb-4">When during the day you study · 24h</p>
          {!hasHourData ? <EmptyState /> : (
            <div>
              <div className="flex items-end gap-[3px] h-32">
                {hourOfDay.map((mins, h) => {
                  const pct = (mins / hourMax) * 100;
                  const isHover = hourHover === h;
                  // Color band: night cool / morning warm / afternoon energy / evening calm
                  const band = h < 6 ? "#60a5fa" : h < 12 ? "#ffb95f" : h < 18 ? "#d2bbff" : "#40efb7";
                  return (
                    <div
                      key={h}
                      onMouseEnter={() => setHourHover(h)}
                      onMouseLeave={() => setHourHover(null)}
                      className="flex-1 cursor-pointer flex items-end min-h-full"
                    >
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${mins > 0 ? Math.max(pct, 3) : 0}%`,
                          background: mins > 0 ? band : "transparent",
                          opacity: isHover ? 1 : 0.85,
                          boxShadow: isHover ? `0 0 12px ${band}` : "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-on-surface-variant font-jetbrains">
                <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
              </div>
              {hourHover !== null && hourOfDay[hourHover] > 0 && (
                <div className="absolute top-4 right-4 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] pointer-events-none">
                  <div className="text-[10px] text-on-surface-variant">{hourHover.toString().padStart(2, "0")}:00 – {(hourHover + 1).toString().padStart(2, "0")}:00</div>
                  <div className="text-sm font-jetbrains font-semibold text-on-surface">{hourOfDay[hourHover]} min</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Focus by Day */}
        <div className="glass-card p-6 relative">
          <h2 className="font-grotesk font-bold text-on-surface mb-1">Focus Score by Day</h2>
          <p className="text-xs text-on-surface-variant mb-4">Avg focus % per weekday · hover a bar</p>
          {!hasFocusData ? <EmptyState /> : (
            <div>
              <div className="flex items-end gap-3 h-32 pl-7 relative">
                {/* Y gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between pl-7 pr-0 pointer-events-none">
                  {[100, 50, 0].map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="absolute -left-0 text-[9px] text-on-surface-variant font-jetbrains">{v}%</span>
                      <div className="border-t border-outline-variant/30 flex-1 w-full" />
                    </div>
                  ))}
                </div>
                {focusByDay.map((d, i) => {
                  const score = d.score;
                  const pct = (score / 100) * 100;
                  const color = score === 0 ? "#252535" : score >= 90 ? "#40efb7" : score >= 80 ? "#d2bbff" : "#ffb95f";
                  const isHover = focusHover === i;
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setFocusHover(i)}
                      onMouseLeave={() => setFocusHover(null)}
                      className="flex-1 flex flex-col items-center gap-1 relative cursor-pointer h-full justify-end"
                    >
                      {score > 0 && (
                        <span className="text-[10px] font-jetbrains text-on-surface absolute" style={{ bottom: `${pct}%`, marginBottom: 4 }}>
                          {score}
                        </span>
                      )}
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${pct}%`,
                          background: color,
                          opacity: isHover ? 1 : 0.85,
                          boxShadow: isHover && score > 0 ? `0 0 12px ${color}` : "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 pl-7 mt-2">
                {DAYS.map((d, i) => (
                  <span key={i} className="flex-1 text-center text-[10px] text-on-surface-variant font-jetbrains">{d}</span>
                ))}
              </div>
              {focusHover !== null && focusByDay[focusHover].score > 0 && (
                <div className="absolute top-4 right-4 bg-[#0e0e14] border border-primary/40 rounded-lg px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.5)] pointer-events-none">
                  <div className="text-[10px] text-on-surface-variant">{DAYS[focusHover]}</div>
                  <div className="text-sm font-jetbrains font-semibold text-on-surface">{focusByDay[focusHover].score}%</div>
                  <div className="text-[10px] text-on-surface-variant">{focusByDay[focusHover].count} session{focusByDay[focusHover].count === 1 ? "" : "s"}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Subject Focus + Heatmap (compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Subject Focus */}
        <div className="glass-card p-6">
          <h2 className="font-grotesk font-bold text-on-surface mb-1">Focus by Subject</h2>
          <p className="text-xs text-on-surface-variant mb-4">Which subjects you focus best on</p>
          {!hasSubjectFocus ? <EmptyState /> : (
            <div className="space-y-3">
              {subjectFocus.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-on-surface truncate w-24 flex-shrink-0" title={s.name}>{s.name}</span>
                  <div className="flex-1 bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${s.avgFocus}%`, background: s.color }}
                    />
                  </div>
                  <span className="font-jetbrains text-xs text-on-surface w-9 text-right">{s.avgFocus}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compact Heatmap */}
        <div className="glass-card p-6 relative">
          <h2 className="font-grotesk font-bold text-on-surface mb-1">Daily Activity</h2>
          <p className="text-xs text-on-surface-variant mb-4">Last 7 weeks · hover a cell</p>
          {!hasHeatmapData ? <EmptyState /> : (
            <>
              <div className="space-y-0.5">
                {HEATMAP_DAYS.map((day, row) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-[10px] text-on-surface-variant w-6 font-jetbrains flex-shrink-0">{day}</span>
                    <div className="flex gap-0.5 flex-1">
                      {heatmapData[row].map((cell, col) => {
                        const opacities = ["opacity-5", "opacity-25", "opacity-45", "opacity-65", "opacity-90"];
                        return (
                          <div
                            key={col}
                            onMouseEnter={() => setHeatHover({ row, col })}
                            onMouseLeave={() => setHeatHover(null)}
                            className={`flex-1 rounded-sm bg-secondary ${opacities[cell.intensity]} hover:ring-2 hover:ring-primary/50 cursor-pointer transition-all`}
                            style={{ height: 18 }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-on-surface-variant">Less</span>
                {[5, 25, 45, 65, 90].map((op) => (
                  <div key={op} className="w-2.5 h-2.5 rounded-sm bg-secondary" style={{ opacity: op / 100 }} />
                ))}
                <span className="text-[10px] text-on-surface-variant">More</span>
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
      </div>

    </div>
  );
}

// ── Small subcomponents ─────────────────────────────────────────────────────

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="glass-card p-5 space-y-1.5">
      <p className="text-xs uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className={`font-jetbrains text-2xl md:text-3xl font-bold ${accent ? "text-secondary" : "text-on-surface"}`}>{value}</p>
      <p className="text-xs text-on-surface-variant">{hint}</p>
    </div>
  );
}

function InsightCard({ icon, iconClass, label, value, sub }: { icon: string; iconClass: string; label: string; value: string; sub: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">
        <span className={`material-symbols-outlined text-[16px] ${iconClass}`}>{icon}</span>
        {label}
      </div>
      <div className="font-grotesk text-xl font-bold text-on-surface">{value}</div>
      <div className="text-xs text-on-surface-variant mt-1">{sub}</div>
    </div>
  );
}
