import type { ClassItem, Exam, Goal, Session, StudyBlock, Task, TimetableSettings } from "@/types";
import { addDays, classOccurrences, mondayOf, toMinutes } from "./timetable";

export type EventKind = "class" | "exam" | "task" | "block" | "session" | "goal";

export interface CalEvent {
  key: string;
  kind: EventKind;
  title: string;
  date: string;
  /** "HH:MM"; missing = all-day item */
  start?: string;
  end?: string;
  subjectId?: string;
  refId?: string;
  done?: boolean;
  detail?: string;
}

export interface CalendarData {
  classes: ClassItem[];
  timetable: TimetableSettings;
  exams: Exam[];
  tasks: Task[];
  blocks: StudyBlock[];
  sessions: Session[];
  /** Optional: goal deadlines show as all-day items */
  goals?: Goal[];
}

export function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** All calendar items between `from` and `to` (inclusive), sorted by date and time. */
export function buildEvents(d: CalendarData, from: string, to: string): CalEvent[] {
  const inRange = (date?: string) => !!date && date >= from && date <= to;
  const out: CalEvent[] = [];
  for (const o of classOccurrences(d.classes, d.timetable, from, to)) {
    out.push({ key: `class-${o.classId}-${o.date}-${o.start}`, kind: "class", title: o.title ?? "Class", date: o.date,
      start: o.start, end: o.end, subjectId: o.subjectId, refId: o.classId, detail: o.room ? `Room ${o.room}` : undefined });
  }
  for (const e of d.exams.filter((x) => inRange(x.date))) {
    out.push({ key: `exam-${e.id}`, kind: "exam", title: e.title, date: e.date, subjectId: e.subjectId, refId: e.id,
      start: e.startTime, end: e.startTime ? minutesToHHMM(toMinutes(e.startTime) + (e.durationMinutes ?? 60)) : undefined,
      detail: e.room ? `Room ${e.room}` : undefined });
  }
  for (const t of d.tasks.filter((x) => inRange(x.dueDate))) {
    out.push({ key: `task-${t.id}`, kind: "task", title: t.title, date: t.dueDate!, subjectId: t.subjectId, refId: t.id, done: t.completed,
      start: t.dueTime, end: t.dueTime ? minutesToHHMM(toMinutes(t.dueTime) + 30) : undefined });
  }
  for (const b of d.blocks.filter((x) => inRange(x.date))) {
    out.push({ key: `block-${b.id}`, kind: "block", title: b.title, date: b.date, start: b.start, end: b.end,
      subjectId: b.subjectId, refId: b.id, done: blockDone(b) });
  }
  for (const s of d.sessions.filter((x) => inRange(x.date) && x.startTime && x.endTime)) {
    // End not after start (midnight crossing, or an old manual log with start = end):
    // use start + duration, capped at 23:59.
    const end = s.endTime > s.startTime ? s.endTime
      : minutesToHHMM(Math.min(toMinutes(s.startTime) + (s.durationMinutes || 0), 23 * 60 + 59));
    out.push({ key: `session-${s.id}`, kind: "session", title: [s.subjectName, s.topicTitle].filter(Boolean).join(" · "), date: s.date, start: s.startTime, end,
      subjectId: s.subjectId, refId: s.id, done: s.id !== "__live", detail: s.id === "__live" ? `studying now, ${s.durationMinutes} min` : `${s.durationMinutes} min` });
  }
  // A goal shows on every day of its period (start → deadline), as an all-day item
  for (const g of d.goals ?? []) {
    const begin = (g.createdAt ?? "").slice(0, 10);
    const start = begin && begin <= g.deadline ? begin : g.deadline;
    for (let day = start < from ? from : start; day <= g.deadline && day <= to; day = addDays(day, 1)) {
      const title = day === g.deadline ? `Due: ${g.title}` : day === start ? `Start: ${g.title}` : g.title;
      out.push({ key: `goal-${g.id}-${day}`, kind: "goal", title, date: day, subjectId: g.subjectId, refId: g.id, done: g.completed });
    }
  }
  return out.sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
}

export function blockMinutes(b: Pick<StudyBlock, "start" | "end">): number {
  return Math.max(0, toMinutes(b.end) - toMinutes(b.start));
}

/** A block is done when marked by hand, or when its sessions reach the planned time. */
export function blockDone(b: StudyBlock): boolean {
  return !!b.done || (b.minutesDone ?? 0) >= blockMinutes(b);
}

/** The 7 dates (Monday first) of the week containing `date`. */
export function weekDates(date: string): string[] {
  const mon = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** 6 rows × 7 days covering the month of `date`, Monday first. */
export function monthGrid(date: string): string[] {
  const first = mondayOf(date.slice(0, 8) + "01");
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export interface PlacedEvent { event: CalEvent; column: number; columns: number }

/** Side-by-side layout for timed events of one day: overlapping events share the width. */
export function layoutDay(events: CalEvent[]): PlacedEvent[] {
  const timed = events.filter((e) => e.start && e.end).sort((a, b) => a.start!.localeCompare(b.start!) || b.end!.localeCompare(a.end!));
  const placed: PlacedEvent[] = [];
  let group: PlacedEvent[] = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((p) => p.column + 1));
    group.forEach((p) => (p.columns = cols));
    placed.push(...group);
    group = [];
  };
  for (const e of timed) {
    const s = toMinutes(e.start!), en = Math.max(toMinutes(e.end!), s + 15);
    if (s >= groupEnd && group.length) flush();
    const used = new Set(group.filter((p) => toMinutes(p.event.end!) > s).map((p) => p.column));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ event: e, column: col, columns: 1 });
    groupEnd = Math.max(groupEnd, en);
  }
  if (group.length) flush();
  return placed;
}

/** First and last hour to draw: 7–22 by default, wider if an event needs it. */
export function hourRange(events: CalEvent[]): [number, number] {
  let first = 7, last = 22;
  for (const e of events) {
    if (!e.start || !e.end) continue;
    first = Math.min(first, Math.floor(toMinutes(e.start) / 60));
    last = Math.max(last, Math.ceil(toMinutes(e.end) / 60));
  }
  return [first, Math.min(24, last)];
}
