import type { ClassItem, Exam, Habit, StudyBlock, Task, TimetableSettings, Subject } from "@/types";
import { classOccurrences, addDays } from "./timetable";
import { zonedToUtc } from "./zonedTime";

export interface PlannedReminder {
  /** Stable id (also the Firestore document id) */
  key: string;
  fireAt: number;
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface ReminderInput {
  timeZone: string;
  tasks: Task[];
  exams: Exam[];
  classes: ClassItem[];
  timetable: TimetableSettings;
  blocks: StudyBlock[];
  habits: Habit[];
  subjects: Subject[];
  /** "HH:MM" for the daily summary, or undefined for none */
  dailySummaryTime?: string;
  /** Cards due per day ("YYYY-MM-DD" → count), for the daily summary */
  cardsDue?: Record<string, number>;
}

/** All-day items are reminded at this local time. */
export const ALL_DAY_TIME = "09:00";

const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 150);

/**
 * Every reminder between `from` and `from + days` (local dates), sorted by time.
 * Reminders in the past are left out. Completed tasks and done blocks are skipped.
 */
export function planReminders(input: ReminderInput, now: number, today: string, days = 14): PlannedReminder[] {
  const tz = input.timeZone;
  const last = addDays(today, days);
  const subjectName = (id?: string) => input.subjects.find((s) => s.id === id)?.name;
  const out: PlannedReminder[] = [];
  const add = (key: string, date: string, time: string, minutesBefore: number, title: string, body: string, url: string, tag: string) => {
    const fireAt = zonedToUtc(date, time, tz) - minutesBefore * 60_000;
    if (fireAt > now && date <= last) out.push({ key: safeId(key), fireAt, title, body, url, tag });
  };

  for (const t of input.tasks) {
    if (t.completed || !t.dueDate || t.reminderMinutesBefore === undefined || t.dueDate < today) continue;
    const time = t.dueTime ?? ALL_DAY_TIME;
    add(`task-${t.id}-${t.dueDate}-${time}-${t.reminderMinutesBefore}`, t.dueDate, time, t.reminderMinutesBefore,
      t.kind === "homework" ? `Homework: ${t.title}` : t.title, `Due ${t.dueTime ? `at ${t.dueTime}` : "today"}${subjectName(t.subjectId) ? ` · ${subjectName(t.subjectId)}` : ""}`, "/tasks/", `task-${t.id}`);
  }
  for (const e of input.exams) {
    if (e.reminderMinutesBefore === undefined || e.date < today) continue;
    const time = e.startTime ?? ALL_DAY_TIME;
    add(`exam-${e.id}-${e.date}-${time}-${e.reminderMinutesBefore}`, e.date, time, e.reminderMinutesBefore,
      `Exam: ${e.title}`, [subjectName(e.subjectId), e.startTime && `starts ${e.startTime}`, e.room && `Room ${e.room}`, e.seat && `Seat ${e.seat}`].filter(Boolean).join(" · "), "/exams/", `exam-${e.id}`);
  }
  for (const o of classOccurrences(input.classes.filter((c) => c.reminderMinutesBefore !== undefined), input.timetable, today, last)) {
    add(`class-${o.classId}-${o.date}-${o.start}`, o.date, o.start, o.reminderMinutesBefore ?? 0,
      `Class: ${subjectName(o.subjectId) ?? "class"}${o.title ? ` (${o.title})` : ""}`, [`${o.start}–${o.end}`, o.room && `Room ${o.room}`].filter(Boolean).join(" · "), "/today/", `class-${o.classId}`);
  }
  for (const b of input.blocks) {
    if (b.done || b.reminderMinutesBefore === undefined || b.date < today) continue;
    add(`block-${b.id}-${b.date}-${b.start}`, b.date, b.start, b.reminderMinutesBefore,
      `Study time: ${b.title}`, `${b.start}–${b.end}. Tap to start.`, "/today/", `block-${b.id}`);
  }
  for (const h of input.habits) {
    if (h.archived || !h.reminderTime) continue;
    for (let d = today; d <= last; d = addDays(d, 1)) {
      add(`habit-${h.id}-${d}-${h.reminderTime}`, d, h.reminderTime, 0, `Habit: ${h.title}`, "Keep your streak going.", "/habits/", `habit-${h.id}`);
    }
  }
  if (input.dailySummaryTime) {
    for (let d = today; d <= last; d = addDays(d, 1)) {
      const tasks = input.tasks.filter((t) => !t.completed && t.dueDate === d).length;
      const exams = input.exams.filter((e) => e.date === d).length;
      const blocks = input.blocks.filter((b) => !b.done && b.date === d).length;
      const cards = input.cardsDue?.[d] ?? 0;
      const parts = [cards && `${cards} card${cards === 1 ? "" : "s"} to review`, tasks && `${tasks} task${tasks === 1 ? "" : "s"} due`,
        exams && `${exams} exam${exams === 1 ? "" : "s"}`, blocks && `${blocks} study block${blocks === 1 ? "" : "s"}`].filter(Boolean);
      add(`summary-${d}-${input.dailySummaryTime}`, d, input.dailySummaryTime, 0, "Your study plan today",
        parts.length ? parts.join(" · ") : "Nothing planned. A good day to review cards.", "/today/", `summary-${d}`);
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}

/** What to write and delete so the stored reminders match the plan. Sent reminders are kept. */
export function diffReminders(stored: { id: string; sent: boolean; fireAt: number; title: string; body: string }[], planned: PlannedReminder[], now: number) {
  const byId = new Map(stored.map((s) => [s.id, s]));
  const wanted = new Set(planned.map((p) => p.key));
  const upsert = planned.filter((p) => {
    const s = byId.get(p.key);
    return !s || (!s.sent && (s.fireAt !== p.fireAt || s.title !== p.title || s.body !== p.body));
  });
  // Unsent future reminders that are no longer planned, and old sent ones (older than 2 days).
  // Test reminders ("test-…") are not part of the plan and are left alone until sent.
  const remove = stored.filter((s) => (!s.sent && !wanted.has(s.id) && !s.id.startsWith("test-") && s.fireAt > now) || (s.sent && s.fireAt < now - 2 * 86_400_000)).map((s) => s.id);
  return { upsert, remove };
}
