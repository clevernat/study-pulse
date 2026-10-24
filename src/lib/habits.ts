import type { Habit } from "@/types";
import { addDays, mondayOf } from "./timetable";

/** Per-day totals from app data, used by automatic habits. */
export interface HabitContext {
  studyMinutes: Record<string, number>;
  cardsReviewed: Record<string, number>;
}
export const EMPTY_CONTEXT: HabitContext = { studyMinutes: {}, cardsReviewed: {} };

export function valueOn(h: Habit, date: string, ctx: HabitContext = EMPTY_CONTEXT): number {
  if (h.autoSource) return ctx[h.autoSource][date] ?? 0;
  return h.log?.[date] ?? 0;
}

export function doneOn(h: Habit, date: string, ctx?: HabitContext): boolean {
  return valueOn(h, date, ctx) >= Math.max(1, h.target);
}

/** Days done in the Monday-based week that contains `date`, up to `until`. */
function doneInWeek(h: Habit, monday: string, until: string, ctx?: HabitContext): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (d > until) break;
    if (doneOn(h, d, ctx)) n++;
  }
  return n;
}

/**
 * Current streak. Daily habits: days in a row. Weekly habits: weeks in a row
 * that reached the goal. Today (or this week) still counts as "in progress":
 * if it is not done yet, the streak from before is kept.
 */
export function currentStreak(h: Habit, today: string, ctx?: HabitContext): number {
  if (h.schedule.type === "daily") {
    let day = doneOn(h, today, ctx) ? today : addDays(today, -1);
    let n = 0;
    while (doneOn(h, day, ctx)) { n++; day = addDays(day, -1); }
    return n;
  }
  const need = h.schedule.timesPerWeek;
  let monday = mondayOf(today);
  if (doneInWeek(h, monday, today, ctx) < need) monday = addDays(monday, -7);
  let n = 0;
  while (doneInWeek(h, monday, addDays(monday, 6), ctx) >= need) { n++; monday = addDays(monday, -7); }
  return n;
}

/** Longest streak ever (same units as currentStreak). */
export function bestStreak(h: Habit, today: string, ctx?: HabitContext): number {
  const dates = h.autoSource ? Object.keys(ctx?.[h.autoSource] ?? {}) : Object.keys(h.log ?? {});
  if (dates.length === 0) return 0;
  const first = dates.sort()[0];
  let best = 0, run = 0;
  if (h.schedule.type === "daily") {
    for (let d = first; d <= today; d = addDays(d, 1)) {
      run = doneOn(h, d, ctx) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  }
  const need = h.schedule.timesPerWeek;
  for (let m = mondayOf(first); m <= today; m = addDays(m, 7)) {
    run = doneInWeek(h, m, addDays(m, 6), ctx) >= need ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Progress for the current period: today for daily habits, this week for weekly ones. */
export function periodProgress(h: Habit, today: string, ctx?: HabitContext): { done: number; needed: number } {
  if (h.schedule.type === "daily") return { done: Math.min(valueOn(h, today, ctx), h.target), needed: h.target };
  return { done: doneInWeek(h, mondayOf(today), today, ctx), needed: h.schedule.timesPerWeek };
}

export function scheduleLabel(h: Habit): string {
  const amount = h.target > 1 ? `${h.target}${h.unit ? ` ${h.unit}` : ""} ` : "";
  return h.schedule.type === "daily" ? `${amount}every day` : `${amount}${h.schedule.timesPerWeek}× a week`;
}

/** Totals per day from sessions and review logs, for automatic habits. */
export function buildContext(sessions: { date: string; durationMinutes: number }[], reviews: { review: number }[], toDate: (ms: number) => string): HabitContext {
  const studyMinutes: Record<string, number> = {};
  for (const s of sessions) studyMinutes[s.date] = (studyMinutes[s.date] ?? 0) + s.durationMinutes;
  const cardsReviewed: Record<string, number> = {};
  for (const r of reviews) { const d = toDate(r.review); cardsReviewed[d] = (cardsReviewed[d] ?? 0) + 1; }
  return { studyMinutes, cardsReviewed };
}
