import type { ClassItem, Exam, Holiday, TimetableSettings } from "@/types";
import { daysAgoStr } from "./dateUtils";

export const DEFAULT_TIMETABLE: TimetableSettings = { rotationWeeks: 1, holidays: [] };
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEK_LETTERS = ["A", "B", "C", "D"];

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(date + "T00:00:00Z");
/** Weekday 0–6 of a "YYYY-MM-DD" date (calendar math, no time zone involved). */
export const weekdayOf = (date: string) => new Date(utc(date)).getUTCDay();
/** The Monday on or before `date`. */
export function mondayOf(date: string): string {
  const back = (weekdayOf(date) + 6) % 7;
  return new Date(utc(date) - back * DAY).toISOString().slice(0, 10);
}
export function addDays(date: string, n: number): string {
  return new Date(utc(date) + n * DAY).toISOString().slice(0, 10);
}
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Which rotation week (1..n) a date falls in. Weeks start on Monday. */
export function rotationWeekFor(date: string, s: TimetableSettings): number {
  const n = Math.max(1, Math.min(4, s.rotationWeeks || 1));
  if (n === 1) return 1;
  const anchor = mondayOf(s.rotationStartDate ?? s.termStart ?? date);
  const weeks = Math.round((utc(mondayOf(date)) - utc(anchor)) / (7 * DAY));
  return (((weeks % n) + n) % n) + 1;
}

export function holidayOn(date: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => date >= h.start && date <= h.end);
}

export function inTerm(date: string, s: TimetableSettings): boolean {
  return (!s.termStart || date >= s.termStart) && (!s.termEnd || date <= s.termEnd);
}

export interface ClassOccurrence {
  classId: string;
  subjectId: string;
  title?: string;
  room?: string;
  teacher?: string;
  date: string;
  start: string;
  end: string;
  reminderMinutesBefore?: number;
}

/** Every class meeting between `from` and `to` (inclusive), skipping holidays and days outside the term. */
export function classOccurrences(classes: ClassItem[], s: TimetableSettings, from: string, to: string): ClassOccurrence[] {
  const out: ClassOccurrence[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (!inTerm(date, s) || holidayOn(date, s.holidays)) continue;
    const wd = weekdayOf(date);
    const week = rotationWeekFor(date, s);
    for (const c of classes) {
      for (const slot of c.slots) {
        if (slot.weekday !== wd) continue;
        if (s.rotationWeeks > 1 && slot.week && slot.week !== week) continue;
        out.push({ classId: c.id, subjectId: c.subjectId, title: c.title, room: c.room, teacher: c.teacher,
          date, start: slot.start, end: slot.end, reminderMinutesBefore: c.reminderMinutesBefore });
      }
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export interface Clash { exam: Exam; occurrence: ClassOccurrence }

/** Exams that overlap a class on the same day. Exams without a start time cannot clash. */
export function findClashes(exams: Exam[], classes: ClassItem[], s: TimetableSettings): Clash[] {
  const out: Clash[] = [];
  for (const exam of exams) {
    if (!exam.startTime) continue;
    const start = toMinutes(exam.startTime);
    const end = start + (exam.durationMinutes ?? 60);
    for (const occ of classOccurrences(classes, s, exam.date, exam.date)) {
      if (start < toMinutes(occ.end) && toMinutes(occ.start) < end) out.push({ exam, occurrence: occ });
    }
  }
  return out;
}

/** Simple check for a new slot: end after start. */
export function validSlot(start: string, end: string): boolean {
  return !!start && !!end && toMinutes(end) > toMinutes(start);
}

export { daysAgoStr };
