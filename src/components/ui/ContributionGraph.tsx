"use client";
import { useEffect, useRef } from "react";
import { contributionWeeks, monthLabels, type DayCell } from "@/lib/contributions";
import { computeLongestStreak, computeStreak } from "@/lib/streakLogic";
import { formatSmartDuration } from "@/lib/dateUtils";

// GitHub's dark-mode greens
const SHADES = ["#1d2027", "#0e4429", "#006d32", "#26a641", "#39d353"];
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

const longDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** One square per day for the last year, like GitHub's contribution graph. */
export default function ContributionGraph({ minutesOn, today, testId = "contribution-graph" }: { minutesOn: (date: string) => number; today: string; testId?: string }) {
  const weeks = contributionWeeks(minutesOn, today);
  const months = monthLabels(weeks);
  const days = weeks.flat().filter((d): d is DayCell => !!d);
  const studied = days.filter((d) => d.minutes > 0);
  const total = studied.reduce((n, d) => n + d.minutes, 0);
  const best = studied.reduce<DayCell | null>((b, d) => (!b || d.minutes > b.minutes ? d : b), null);
  const dates = studied.map((d) => d.date);
  const scroller = useRef<HTMLDivElement>(null);

  // Show the latest weeks first on narrow screens
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, []);

  return (
    <section data-testid={testId} className="glass-card p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-grotesk font-bold text-lg text-on-surface">Study activity</h2>
          <p className="text-sm text-on-surface-variant" data-testid={`${testId}-total`}>{formatSmartDuration(total)} in the last year, on {studied.length} day{studied.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant" aria-hidden="true">
          <span>Less</span>
          {SHADES.map((c) => <span key={c} className="w-3 h-3 rounded-[3px]" style={{ background: c }} />)}
          <span>More</span>
        </div>
      </div>

      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `28px repeat(${weeks.length}, 12px)`, gridTemplateRows: `14px repeat(7, 12px)` }}>
          <span />
          {months.map((m, i) => <span key={`m${i}`} className="text-[10px] text-on-surface-variant leading-none whitespace-nowrap">{m}</span>)}
          {DAYS.map((label, row) => (
            <div key={`row${row}`} className="contents">
              <span className="text-[10px] text-on-surface-variant leading-[12px]">{label}</span>
              {weeks.map((week, w) => {
                const cell = week[row];
                if (!cell) return <span key={`${w}-${row}`} />;
                const text = `${cell.minutes ? formatSmartDuration(cell.minutes) : "No study"} on ${longDate(cell.date)}`;
                return (
                  <span key={cell.date} data-testid="contribution-day" data-level={cell.level} data-date={cell.date} title={text} aria-label={text}
                    className={`w-3 h-3 rounded-[3px] ${cell.date === today ? "ring-1 ring-on-surface-variant" : ""}`} style={{ background: SHADES[cell.level] }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { k: "Days studied", v: String(studied.length) },
          { k: "Current streak", v: `${computeStreak(dates, today)} days` },
          { k: "Longest streak", v: `${computeLongestStreak(dates)} days` },
          { k: "Best day", v: best ? `${formatSmartDuration(best.minutes)}` : "–", sub: best ? new Date(best.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "" },
        ].map((s) => (
          <div key={s.k} className="flex flex-col-reverse">
            <dt className="text-xs text-on-surface-variant">{s.k}{s.sub ? ` · ${s.sub}` : ""}</dt>
            <dd className="font-jetbrains font-semibold text-on-surface">{s.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
