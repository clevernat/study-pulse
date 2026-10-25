"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCollection } from "@/lib/firebase/useCollection";
import { useStudyTargets } from "@/lib/firebase/useStudyTargets";
import { weeklyReview } from "@/lib/insights";
import { addDays, mondayOf } from "@/lib/timetable";
import { formatSmartDuration, localDateStr } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import { ratingColor } from "@/components/ui/FocusBadge";
import type { Session, Subject } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtRange(start: string, end: string) {
  const f = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(start)} – ${f(end)}`;
}

function Card({ title, icon, children, testId }: { title: string; icon: string; children: React.ReactNode; testId: string }) {
  return (
    <section data-testid={testId} className="glass-card p-5 flex flex-col gap-3">
      <h2 className="font-grotesk font-bold text-base text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );
}

/** "+12%" / "−8%" against last week, colored. */
function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-on-surface-variant">no study last week to compare</span>;
  return <span className={`text-sm font-jetbrains font-bold ${pct >= 0 ? "text-secondary" : "text-tertiary"}`}>{pct >= 0 ? "+" : "−"}{Math.abs(pct)}% vs last week</span>;
}

export default function WeeklyReviewPage() {
  const { items: sessions, loading } = useCollection<Session>("sessions");
  const { items: subjects } = useCollection<Subject>("subjects");
  const { weekly } = useStudyTargets();
  const today = localDateStr();
  const thisMonday = mondayOf(today);
  const [weekStart, setWeekStart] = useState(thisMonday);
  const r = useMemo(() => weeklyReview(sessions, subjects, weekStart, today), [sessions, subjects, weekStart, today]);
  const maxDay = Math.max(30, ...r.perDay);
  const isThisWeek = weekStart === thisMonday;

  if (loading) return null;
  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-on-surface">Weekly review</h1>
          <p data-testid="review-week" className="text-sm text-on-surface-variant">{fmtRange(r.weekStart, r.weekEnd)}{isThisWeek ? " · this week so far" : ""}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week" className="p-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button onClick={() => setWeekStart(thisMonday)} disabled={isThisWeek} className="px-3 py-1.5 rounded-lg border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface disabled:opacity-40">This week</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={isThisWeek} aria-label="Next week" className="p-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* 1. Hours vs last week */}
      <Card title="Study time" icon="schedule" testId="review-hours">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span data-testid="review-this-week" className="font-jetbrains font-bold text-3xl text-on-surface">{formatSmartDuration(r.thisWeek)}</span>
          <Change pct={r.changePct} />
        </div>
        <p className="text-xs text-on-surface-variant">Last week: {formatSmartDuration(r.lastWeek)}{weekly ? ` · weekly target: ${formatSmartDuration(weekly)}` : ""}</p>
        <div className="flex items-end gap-2 h-24 mt-1">
          {r.perDay.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${DAYS[i]}: ${formatSmartDuration(m)}`}>
              <div className="w-full rounded-t bg-primary-container" style={{ height: `${(m / maxDay) * 100}%`, minHeight: m ? 3 : 0 }} />
              <span className="text-[10px] text-on-surface-variant">{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* 2. Neglected subject */}
        <Card title="Needs attention" icon="report" testId="review-neglected">
          {r.neglected ? (
            <>
              <p className="text-on-surface">
                <span className="font-semibold">{r.neglected.name}</span>: {formatSmartDuration(r.neglected.thisWeek)} this week,
                usually {formatSmartDuration(r.neglected.usualWeek)} a week.
              </p>
              <Link href={`/timer`} className="text-xs text-primary underline underline-offset-2 self-start">Plan a session →</Link>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">No subject fell behind your usual week. {r.subjects.length === 0 ? "Add subjects to see this." : ""}</p>
          )}
        </Card>

        {/* 3. Best study time */}
        <Card title="Your best study time" icon="wb_twilight" testId="review-best-time">
          {r.bestTime ? (
            <>
              <p className="text-on-surface"><span className="font-semibold">{r.bestTime.part}</span>
                {r.bestTime.partRating !== null ? <> · focus <span className={ratingColor(r.bestTime.partRating)}>{r.bestTime.partRating}/5</span></> : <> · {formatSmartDuration(r.bestTime.partMinutes)}</>}
              </p>
              <p className="text-sm text-on-surface-variant">Most study on <span className="text-on-surface">{r.bestTime.weekday}s</span> ({formatSmartDuration(r.bestTime.weekdayMinutes)}). Based on the last 5 weeks{r.bestTime.partRating !== null ? ", best focus first" : ""}.</p>
            </>
          ) : <p className="text-sm text-on-surface-variant">Study a few sessions to see when you work best.</p>}
        </Card>

        {/* 4. Streak */}
        <Card title="Streak" icon="local_fire_department" testId="review-streak">
          <p className="text-on-surface"><span className="font-jetbrains font-bold text-2xl">{r.streak}</span> day{r.streak === 1 ? "" : "s"} in a row</p>
          <p className="text-sm text-on-surface-variant">Longest ever: {r.longestStreak} day{r.longestStreak === 1 ? "" : "s"}</p>
        </Card>

        {/* Focus quality */}
        <Card title="Focus" icon="psychology" testId="review-focus">
          <p className="text-on-surface">
            {r.rating !== null ? <>Average <span className={`font-jetbrains font-bold ${ratingColor(r.rating)}`}>{r.rating}/5</span></> : "No rated sessions"}
            {r.lastWeekRating !== null && <span className="text-sm text-on-surface-variant"> · last week {r.lastWeekRating}/5</span>}
          </p>
          <p className="text-sm text-on-surface-variant">
            Distractions: {r.distractionsPerHour !== null ? `${r.distractionsPerHour} per hour` : "–"}
            {r.lastWeekDistractionsPerHour !== null && ` (last week ${r.lastWeekDistractionsPerHour})`}
          </p>
        </Card>
      </div>

      {/* Subjects this week vs last week */}
      <Card title="Subjects" icon="school" testId="review-subjects">
        {r.subjects.length === 0 ? <p className="text-sm text-on-surface-variant">No subjects yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-on-surface-variant text-left"><th className="py-1 font-normal">Subject</th><th className="font-normal text-right">This week</th><th className="font-normal text-right">Last week</th><th className="font-normal text-right hidden sm:table-cell">Usual week</th></tr></thead>
            <tbody>
              {r.subjects.map((s) => (
                <tr key={s.subjectId} className="border-t border-outline-variant/40">
                  <td className="py-2"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: getColor(s.color).dot }} />{s.name}</td>
                  <td className="text-right font-jetbrains">{formatSmartDuration(s.thisWeek)}</td>
                  <td className="text-right font-jetbrains text-on-surface-variant">{formatSmartDuration(s.lastWeek)}</td>
                  <td className="text-right font-jetbrains text-on-surface-variant hidden sm:table-cell">{formatSmartDuration(s.usualWeek)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {r.topTopics.length > 0 && (
          <p data-testid="review-topics" className="text-sm text-on-surface-variant">
            Top topics: {r.topTopics.map((t) => `${t.title} (${formatSmartDuration(t.minutes)})`).join(", ")}
          </p>
        )}
      </Card>
    </div>
  );
}
