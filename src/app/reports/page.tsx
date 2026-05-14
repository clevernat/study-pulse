"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeSessions } from "@/lib/firebase/firestore";
import type { Session } from "@/types";

type Period = "This Week" | "This Month" | "Last 3 Months";

const PERIODS: Period[] = ["This Week", "This Month", "Last 3 Months"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_COLS = 7; // 7 weeks

const SUBJECT_COLORS = ["#d2bbff", "#40efb7", "#ffb95f", "#7c3aed", "#958da1", "#f472b6", "#60a5fa"];

const EmptyState = () => (
  <div className="text-center text-[#958da1] font-inter py-8">
    No data yet — start logging sessions!
  </div>
);

// Get ISO week number for a date
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
  let cutoff: Date;
  if (period === "This Week") {
    const day = now.getDay() || 7;
    cutoff = new Date(now);
    cutoff.setDate(now.getDate() - day + 1);
    cutoff.setHours(0, 0, 0, 0);
  } else if (period === "This Month") {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    cutoff = new Date(now);
    cutoff.setMonth(now.getMonth() - 3);
  }
  return sessions.filter((s) => new Date(s.date) >= cutoff);
}

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
  const totalHours = (totalMinutes / 60).toFixed(1);
  const sessionCount = sessions.length;
  const avgFocusScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length)
      : 0;

  // Best subject by total minutes
  const subjectMinutes: Record<string, { name: string; minutes: number }> = {};
  for (const s of sessions) {
    if (!subjectMinutes[s.subjectId]) {
      subjectMinutes[s.subjectId] = { name: s.subjectName, minutes: 0 };
    }
    subjectMinutes[s.subjectId].minutes += s.durationMinutes;
  }
  const bestSubjectEntry = Object.values(subjectMinutes).sort((a, b) => b.minutes - a.minutes)[0];
  const bestSubject = bestSubjectEntry
    ? { name: bestSubjectEntry.name, hours: (bestSubjectEntry.minutes / 60).toFixed(1) }
    : null;

  // ── Weekly trend (last 8 weeks) ───────────────────────────────────────────
  const weeklyHours = useMemo(() => {
    const now = new Date();
    const weeks: { key: string; label: string; hours: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      weeks.push({ key: getWeekKey(d), label: `W${8 - i}`, hours: 0 });
    }
    for (const s of allSessions) {
      const key = getWeekKey(new Date(s.date));
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
    `${weeklyPoints[0].x},${chartHeight} ` +
    weeklyPoints.map((p) => `${p.x},${p.y}`).join(" ") +
    ` ${weeklyPoints[weeklyPoints.length - 1].x},${chartHeight}`;

  // ── Subject distribution donut ────────────────────────────────────────────
  const donutSubjects = useMemo(() => {
    const entries = Object.values(subjectMinutes).sort((a, b) => b.minutes - a.minutes);
    if (entries.length === 0) return [];
    const total = entries.reduce((s, e) => s + e.minutes, 0);
    return entries.slice(0, 5).map((e, i) => ({
      name: e.name,
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

  // ── Heatmap (last 7×7 = 49 days) ─────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const now = new Date();
    // Build a date-keyed map of minutes from all sessions
    const dateMap: Record<string, number> = {};
    for (const s of allSessions) {
      dateMap[s.date] = (dateMap[s.date] ?? 0) + s.durationMinutes;
    }
    // 7 rows (Mon-Sun) × 7 cols (weeks, oldest left)
    // Find the most recent Monday
    const dayOfWeek = now.getDay() || 7; // 1=Mon, 7=Sun
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - dayOfWeek + 7); // end of current week (Sunday)
    lastSunday.setHours(0, 0, 0, 0);

    const grid: number[][] = Array.from({ length: 7 }, () => Array(HEATMAP_COLS).fill(0));

    for (let col = 0; col < HEATMAP_COLS; col++) {
      for (let row = 0; row < 7; row++) {
        const daysBack = (HEATMAP_COLS - 1 - col) * 7 + (6 - row);
        const d = new Date(lastSunday);
        d.setDate(lastSunday.getDate() - daysBack);
        const key = d.toISOString().slice(0, 10);
        grid[row][col] = dateMap[key] ?? 0;
      }
    }

    // Compute intensity 0-4 based on quartiles across all non-zero values
    const allNonZero = grid.flat().filter((v) => v > 0).sort((a, b) => a - b);
    const q1 = allNonZero[Math.floor(allNonZero.length * 0.25)] ?? 30;
    const q2 = allNonZero[Math.floor(allNonZero.length * 0.5)] ?? 60;
    const q3 = allNonZero[Math.floor(allNonZero.length * 0.75)] ?? 90;

    return grid.map((row) =>
      row.map((minutes) => {
        if (minutes === 0) return 0;
        if (minutes <= q1) return 1;
        if (minutes <= q2) return 2;
        if (minutes <= q3) return 3;
        return 4;
      })
    );
  }, [allSessions]);

  const hasHeatmapData = heatmapData.flat().some((v) => v > 0);

  // ── Focus score by day of week ────────────────────────────────────────────
  const focusByDay = useMemo(() => {
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const s of sessions) {
      const dow = new Date(s.date).getDay(); // 0=Sun, 1=Mon...6=Sat
      const idx = dow === 0 ? 6 : dow - 1; // shift to Mon=0...Sun=6
      sums[idx] += s.focusScore;
      counts[idx]++;
    }
    return sums.map((sum, i) => (counts[i] > 0 ? Math.round(sum / counts[i]) : 0));
  }, [sessions]);

  const hasFocusData = focusByDay.some((v) => v > 0);

  // Bar chart dimensions
  const barMax = 100;
  const barChartHeight = 120;
  const barWidth = 32;
  const barGap = 12;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-space text-2xl font-bold text-[#e8e8f0]">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-[#958da1] mt-1">
            Track your learning performance over time
          </p>
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

      {/* Top Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#958da1]">Total Study Time</p>
          <p className="font-jetbrains text-3xl font-bold text-[#e8e8f0]">
            {loading ? "—" : `${totalHours}h`}
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
          <p className="text-sm text-primary">
            {bestSubject ? `${bestSubject.hours}h logged` : "No sessions yet"}
          </p>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-3 gap-4">
        {/* Weekly Trend Chart */}
        <div className="col-span-2 glass-card p-6">
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">
            Weekly Learning Trend
          </h2>
          {!hasWeeklyData ? (
            <EmptyState />
          ) : (
            <svg
              viewBox="0 0 400 150"
              className="w-full"
              aria-label="Weekly learning trend line chart"
            >
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="1" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                </linearGradient>
              </defs>

              {[0, 1, 2, 3].map((i) => {
                const y = 10 + (i * chartHeight) / 3;
                return (
                  <line key={i} x1="10" y1={y} x2="390" y2={y} stroke="#252535" strokeWidth="1" />
                );
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
                <circle key={i} cx={p.x + 10} cy={p.y + 10} r="3" fill="#d2bbff" />
              ))}

              {weeklyHours.map((w, i) => (
                <text
                  key={i}
                  x={i * stepX + 10}
                  y={148}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#958da1"
                  fontFamily="monospace"
                >
                  {w.label}
                </text>
              ))}
            </svg>
          )}
        </div>

        {/* Subject Distribution Donut */}
        <div className="glass-card p-6">
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">
            Subject Distribution
          </h2>
          {donutSubjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col items-center">
              <svg
                viewBox="0 0 160 160"
                className="w-36 h-36"
                aria-label="Subject distribution donut chart"
              >
                {donutArcs.map((arc, i) => (
                  <circle
                    key={i}
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="20"
                    strokeDasharray={`${arc.dash} ${2 * Math.PI * 60 - arc.dash}`}
                    strokeDashoffset={arc.offset}
                    transform="rotate(-90 80 80)"
                  />
                ))}
                <text
                  x="80"
                  y="76"
                  textAnchor="middle"
                  fontSize="11"
                  fill="#e8e8f0"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {donutSubjects.length}
                </text>
                <text
                  x="80"
                  y="90"
                  textAnchor="middle"
                  fontSize="9"
                  fill="#958da1"
                  fontFamily="monospace"
                >
                  Subjects
                </text>
              </svg>

              <div className="mt-4 space-y-2 w-full">
                {donutSubjects.map((subject) => (
                  <div key={subject.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: subject.color }}
                      />
                      <span className="text-xs text-[#c4c4d4]">{subject.name}</span>
                    </div>
                    <span className="text-xs font-jetbrains text-[#958da1]">
                      {subject.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Study Heatmap */}
        <div className="glass-card p-6">
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">
            Study Time Heatmap
          </h2>
          {!hasHeatmapData ? (
            <EmptyState />
          ) : (
            <>
              <div className="space-y-1.5">
                {HEATMAP_DAYS.map((day, row) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs text-[#958da1] w-8 font-jetbrains flex-shrink-0">
                      {day}
                    </span>
                    <div className="flex gap-1 flex-1">
                      {heatmapData[row].map((intensity, col) => {
                        const opacities = ["opacity-5", "opacity-25", "opacity-45", "opacity-65", "opacity-90"];
                        return (
                          <div
                            key={col}
                            className={`flex-1 aspect-square rounded-sm bg-secondary ${opacities[intensity]}`}
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
                  <div
                    key={op}
                    className="w-3 h-3 rounded-sm bg-secondary"
                    style={{ opacity: op / 100 }}
                  />
                ))}
                <span className="text-xs text-[#958da1]">More</span>
              </div>
            </>
          )}
        </div>

        {/* Focus Score by Day of Week */}
        <div className="glass-card p-6">
          <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">
            Focus Score by Day
          </h2>
          {!hasFocusData ? (
            <EmptyState />
          ) : (
            <svg
              viewBox={`0 0 ${(barWidth + barGap) * 7 + 40} 160`}
              className="w-full"
              aria-label="Focus score by day of week bar chart"
            >
              {[0, 50, 100].map((val) => {
                const y = 10 + barChartHeight - (val / barMax) * barChartHeight;
                return (
                  <g key={val}>
                    <line
                      x1="30"
                      y1={y}
                      x2={(barWidth + barGap) * 7 + 40}
                      y2={y}
                      stroke="#252535"
                      strokeWidth="1"
                    />
                    <text
                      x="26"
                      y={y + 4}
                      textAnchor="end"
                      fontSize="9"
                      fill="#958da1"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {focusByDay.map((score, i) => {
                const barHeight = (score / barMax) * barChartHeight;
                const x = 34 + i * (barWidth + barGap);
                const y = 10 + barChartHeight - barHeight;
                const color =
                  score === 0
                    ? "#252535"
                    : score >= 90
                    ? "#40efb7"
                    : score >= 80
                    ? "#d2bbff"
                    : "#ffb95f";

                return (
                  <g key={i}>
                    {score > 0 && (
                      <>
                        <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill={color} fillOpacity="0.85" />
                        <text
                          x={x + barWidth / 2}
                          y={y - 4}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#e8e8f0"
                          fontFamily="monospace"
                        >
                          {score}
                        </text>
                      </>
                    )}
                    <text
                      x={x + barWidth / 2}
                      y={148}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#958da1"
                      fontFamily="monospace"
                    >
                      {DAYS[i]}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
