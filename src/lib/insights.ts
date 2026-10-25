// Study insights: targets, time per topic, focus ratings, the weekly review and
// test results compared with hours studied. Pure functions on sessions (no Firestore).
import type { Goal, Session, Subject, TestResult } from "@/types";
import { addDays, mondayOf, weekdayOf, WEEKDAYS } from "./timetable";
import { computeStreak, computeLongestStreak } from "./streakLogic";

const sum = (list: Session[]) => list.reduce((n, s) => n + s.durationMinutes, 0);
const inRange = (s: Session, from: string, to: string) => s.date >= from && s.date <= to;

/** Hours studied toward a goal: its subject's sessions from when it was made to its deadline. */
export function goalHours(goal: Goal, sessions: Session[]): number {
  if (!goal.subjectId) return 0;
  return sum(sessions.filter((s) => s.subjectId === goal.subjectId && s.date >= goal.createdAt && s.date <= goal.deadline)) / 60;
}

// ── Targets ────────────────────────────────────────────────────────────────

export interface TargetProgress {
  todayMinutes: number;
  weekMinutes: number;
  /** Monday of this week ("YYYY-MM-DD") */
  weekStart: string;
  daily?: { target: number; pct: number; left: number };
  weekly?: {
    target: number;
    pct: number;
    left: number;
    /** Where you should be by the end of today if you spread the target evenly over Mon–Sun */
    expectedByToday: number;
    onTrack: boolean;
  };
}

/** Today's and this week's minutes against the targets (minutes; 0 or missing = no target). */
export function targetProgress(sessions: Session[], today: string, dailyTarget?: number, weeklyTarget?: number): TargetProgress {
  const weekStart = mondayOf(today);
  const todayMinutes = sum(sessions.filter((s) => s.date === today));
  const weekMinutes = sum(sessions.filter((s) => inRange(s, weekStart, addDays(weekStart, 6))));
  const out: TargetProgress = { todayMinutes, weekMinutes, weekStart };
  if (dailyTarget && dailyTarget > 0) {
    out.daily = { target: dailyTarget, pct: Math.min(100, Math.round((todayMinutes / dailyTarget) * 100)), left: Math.max(0, dailyTarget - todayMinutes) };
  }
  if (weeklyTarget && weeklyTarget > 0) {
    const daysDone = (weekdayOf(today) + 6) % 7 + 1; // Monday = 1 … Sunday = 7
    const expectedByToday = Math.round((weeklyTarget * daysDone) / 7);
    out.weekly = {
      target: weeklyTarget,
      pct: Math.min(100, Math.round((weekMinutes / weeklyTarget) * 100)),
      left: Math.max(0, weeklyTarget - weekMinutes),
      expectedByToday,
      onTrack: weekMinutes >= expectedByToday,
    };
  }
  return out;
}

// ── Topics ─────────────────────────────────────────────────────────────────

/** Minutes per topic id for one subject ("" = sessions without a topic). */
export function minutesByTopic(sessions: Session[], subjectId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    if (s.subjectId !== subjectId) continue;
    const key = s.topicId ?? "";
    out[key] = (out[key] ?? 0) + s.durationMinutes;
  }
  return out;
}

// ── Focus ratings ──────────────────────────────────────────────────────────

/** Average 1–5 rating of the rated sessions (null when none are rated), weighted by minutes. */
export function averageRating(sessions: Session[]): number | null {
  const rated = sessions.filter((s) => s.focusRating && s.focusRating >= 1 && s.focusRating <= 5);
  const minutes = sum(rated);
  if (rated.length === 0 || minutes === 0) return null;
  return Math.round((rated.reduce((n, s) => n + s.focusRating! * s.durationMinutes, 0) / minutes) * 10) / 10;
}

export interface WeekRating { weekStart: string; rating: number | null; rated: number }

/** Average focus rating for each of the last `weeks` weeks (oldest first, Monday weeks). */
export function focusTrend(sessions: Session[], today: string, weeks = 8): WeekRating[] {
  const thisMonday = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(thisMonday, -7 * (weeks - 1 - i));
    const list = sessions.filter((s) => inRange(s, weekStart, addDays(weekStart, 6)));
    return { weekStart, rating: averageRating(list), rated: list.filter((s) => s.focusRating).length };
  });
}

/** Distractions per hour of focus (null when there is no timed focus). */
export function distractionsPerHour(sessions: Session[]): number | null {
  const minutes = sum(sessions);
  if (minutes === 0) return null;
  return Math.round((sessions.reduce((n, s) => n + (s.distractions ?? 0), 0) / (minutes / 60)) * 10) / 10;
}

// ── Weekly review ──────────────────────────────────────────────────────────

export const DAY_PARTS = [
  { key: "morning", label: "Morning (5–12)", from: 5, to: 12 },
  { key: "afternoon", label: "Afternoon (12–17)", from: 12, to: 17 },
  { key: "evening", label: "Evening (17–21)", from: 17, to: 21 },
  { key: "night", label: "Night (21–5)", from: 21, to: 29 },
] as const;

function dayPartOf(startTime: string) {
  const h = Number(startTime.slice(0, 2));
  const hh = h < 5 ? h + 24 : h;
  return DAY_PARTS.find((p) => hh >= p.from && hh < p.to) ?? DAY_PARTS[3];
}

export interface SubjectWeek { subjectId: string; name: string; color: string; thisWeek: number; lastWeek: number; usualWeek: number }

export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  thisWeek: number;
  lastWeek: number;
  /** % change against last week (null when last week was 0) */
  changePct: number | null;
  /** Minutes per day, Monday first */
  perDay: number[];
  subjects: SubjectWeek[];
  /** The subject that lost the most time against your usual week (4-week average), if any */
  neglected: SubjectWeek | null;
  /** Best part of the day and weekday over the last 4 weeks */
  bestTime: { part: string; partMinutes: number; partRating: number | null; weekday: string; weekdayMinutes: number } | null;
  streak: number;
  longestStreak: number;
  rating: number | null;
  lastWeekRating: number | null;
  distractionsPerHour: number | null;
  lastWeekDistractionsPerHour: number | null;
  topTopics: { title: string; subjectName: string; minutes: number }[];
}

/** Everything the weekly review page shows, for the Monday week starting at `weekStart`. */
export function weeklyReview(sessions: Session[], subjects: Subject[], weekStart: string, today: string): WeeklyReview {
  const weekEnd = addDays(weekStart, 6);
  const lastStart = addDays(weekStart, -7);
  const lastEnd = addDays(weekStart, -1);
  const fourStart = addDays(weekStart, -28);
  const thisList = sessions.filter((s) => inRange(s, weekStart, weekEnd));
  const lastList = sessions.filter((s) => inRange(s, lastStart, lastEnd));
  const fourList = sessions.filter((s) => inRange(s, fourStart, lastEnd));
  const thisWeek = sum(thisList);
  const lastWeek = sum(lastList);

  const perDay = Array.from({ length: 7 }, (_, i) => sum(thisList.filter((s) => s.date === addDays(weekStart, i))));

  const subjectRows: SubjectWeek[] = subjects.map((sub) => ({
    subjectId: sub.id, name: sub.name, color: sub.color,
    thisWeek: sum(thisList.filter((s) => s.subjectId === sub.id)),
    lastWeek: sum(lastList.filter((s) => s.subjectId === sub.id)),
    usualWeek: Math.round(sum(fourList.filter((s) => s.subjectId === sub.id)) / 4),
  })).sort((a, b) => b.thisWeek - a.thisWeek || a.name.localeCompare(b.name));

  // Neglected: the biggest drop from your usual week; a subject you never studied is not "neglected".
  const drops = subjectRows.map((r) => ({ r, drop: r.usualWeek - r.thisWeek })).filter((x) => x.drop > 0 && x.r.usualWeek > 0);
  drops.sort((a, b) => b.drop - a.drop);
  const neglected = drops[0]?.r ?? null;

  // Best time: over the 4 weeks before plus this week. Rated focus wins when there are ratings.
  const window = sessions.filter((s) => inRange(s, fourStart, weekEnd) && s.startTime);
  let bestTime: WeeklyReview["bestTime"] = null;
  if (window.length > 0) {
    const parts = DAY_PARTS.map((p) => {
      const list = window.filter((s) => dayPartOf(s.startTime).key === p.key);
      return { label: p.label, minutes: sum(list), rating: averageRating(list) };
    }).filter((p) => p.minutes > 0);
    const anyRated = parts.some((p) => p.rating !== null);
    parts.sort((a, b) => anyRated ? ((b.rating ?? 0) - (a.rating ?? 0) || b.minutes - a.minutes) : b.minutes - a.minutes);
    const days = WEEKDAYS.map((name, wd) => ({ name, minutes: sum(window.filter((s) => weekdayOf(s.date) === wd)) }))
      .sort((a, b) => b.minutes - a.minutes);
    bestTime = { part: parts[0].label, partMinutes: parts[0].minutes, partRating: parts[0].rating, weekday: days[0].name, weekdayMinutes: days[0].minutes };
  }

  const topicMap = new Map<string, { title: string; subjectName: string; minutes: number }>();
  for (const s of thisList) {
    if (!s.topicId) continue;
    const t = topicMap.get(s.topicId) ?? { title: s.topicTitle ?? "Topic", subjectName: subjects.find((x) => x.id === s.subjectId)?.name ?? s.subjectName, minutes: 0 };
    t.minutes += s.durationMinutes;
    topicMap.set(s.topicId, t);
  }

  const dates = sessions.map((s) => s.date);
  return {
    weekStart, weekEnd, thisWeek, lastWeek,
    changePct: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null,
    perDay,
    subjects: subjectRows,
    neglected,
    bestTime,
    streak: computeStreak(dates, today),
    longestStreak: computeLongestStreak(dates),
    rating: averageRating(thisList),
    lastWeekRating: averageRating(lastList),
    distractionsPerHour: distractionsPerHour(thisList.filter((s) => s.sessionType !== "Flashcards")),
    lastWeekDistractionsPerHour: distractionsPerHour(lastList.filter((s) => s.sessionType !== "Flashcards")),
    topTopics: [...topicMap.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5),
  };
}

// ── Results compared with effort ───────────────────────────────────────────

export const RESULT_WINDOW_DAYS = 14;

export interface ResultPoint { result: TestResult; pct: number; minutesBefore: number }

/** Each result with the minutes studied for its subject in the 14 days up to the test day. */
export function resultsWithEffort(results: TestResult[], sessions: Session[], subjectId: string): ResultPoint[] {
  return results
    .filter((r) => r.subjectId === subjectId && r.maxScore > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((r) => ({
      result: r,
      pct: Math.round((r.score / r.maxScore) * 100),
      minutesBefore: sum(sessions.filter((s) => s.subjectId === subjectId && inRange(s, addDays(r.date, -(RESULT_WINDOW_DAYS - 1)), r.date))),
    }));
}

/** Correlation (Pearson r) between hours studied and score; null with fewer than 3 results or no spread. */
export function effortCorrelation(points: ResultPoint[]): number | null {
  if (points.length < 3) return null;
  const xs = points.map((p) => p.minutesBefore), ys = points.map((p) => p.pct);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (sxx === 0 || syy === 0) return null;
  return Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100;
}

/** Plain-language reading of the correlation. */
export function effortVerdict(r: number | null, count: number): string {
  if (r === null) return count < 3 ? `Add ${3 - count} more result${3 - count === 1 ? "" : "s"} to see if more study time brings better scores.` : "Not enough difference between your results to compare yet.";
  if (r >= 0.5) return "Clear link: when you study more, you score higher.";
  if (r >= 0.2) return "Some link: more study time tends to bring better scores.";
  if (r > -0.2) return "No clear link yet between study time and scores. Look at how you study, not only how long.";
  return "More hours have not brought better scores. Try different methods (practice tests, flashcards) instead of more time.";
}
