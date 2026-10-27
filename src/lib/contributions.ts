// GitHub-style contribution graph: one square per day for the last year,
// columns are weeks (Sunday at the top), darker = more study.
import { addDays, weekdayOf } from "./timetable";

export interface DayCell { date: string; minutes: number; level: 0 | 1 | 2 | 3 | 4 }

/** Study minutes → shade. Fixed steps so a level means the same thing for everyone. */
export function level(minutes: number): DayCell["level"] {
  return minutes <= 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4;
}

/**
 * 53 weeks of days ending on the week that holds `today`; days after today are null.
 * `minutesOn(date)` gives the study minutes of a day.
 */
export function contributionWeeks(minutesOn: (date: string) => number, today: string): (DayCell | null)[][] {
  const lastSunday = addDays(today, -weekdayOf(today));
  const start = addDays(lastSunday, -52 * 7);
  return Array.from({ length: 53 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      if (date > today) return null;
      const minutes = minutesOn(date);
      return { date, minutes, level: level(minutes) };
    }));
}

/** Month label for each week column (where a new month starts), else "". */
export function monthLabels(weeks: (DayCell | null)[][]): string[] {
  let last = "";
  return weeks.map((week) => {
    const first = week.find(Boolean);
    const m = first ? new Date(first.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" }) : "";
    if (m && m !== last && new Date(first!.date + "T12:00:00").getDate() <= 7) { last = m; return m; }
    return "";
  });
}
