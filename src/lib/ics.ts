// Builds an iCalendar (.ics) file (RFC 5545) for calendar apps.
import type { ClassItem, Exam, StudyBlock, Subject, Task, TimetableSettings } from "@/types";
import { classOccurrences, addDays } from "./timetable";
import { zonedToUtc } from "./zonedTime";
import { toMinutes } from "./timetable";

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 bytes are folded (continued with a leading space). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateValue = (d: string) => d.replace(/-/g, "");

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** Timed: start/end in UTC ms. All-day: date (+1 day end). */
  start?: number;
  end?: number;
  date?: string;
}

export function buildIcs(events: IcsEvent[], calName: string, now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StudyPulse//Study planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(now)}`);
    if (e.date) lines.push(`DTSTART;VALUE=DATE:${dateValue(e.date)}`, `DTEND;VALUE=DATE:${dateValue(addDays(e.date, 1))}`);
    else lines.push(`DTSTART:${utcStamp(e.start!)}`, `DTEND:${utcStamp(e.end ?? e.start! + 3_600_000)}`);
    lines.push(`SUMMARY:${escapeText(e.summary)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export interface FeedData {
  timeZone: string;
  subjects: Subject[];
  exams: Exam[];
  tasks: Task[];
  blocks: StudyBlock[];
  classes: ClassItem[];
  timetable: TimetableSettings;
}

/**
 * Calendar events for the feed: exams, open tasks/homework with a due date,
 * planned study blocks and class meetings, from `from` to `to` (local dates).
 * Classes are listed one by one (this handles A/B weeks and holidays exactly).
 */
export function feedEvents(d: FeedData, from: string, to: string): IcsEvent[] {
  const tz = d.timeZone;
  const name = (id?: string) => d.subjects.find((s) => s.id === id)?.name;
  const at = (date: string, time: string) => zonedToUtc(date, time, tz);
  const inRange = (date?: string) => !!date && date >= from && date <= to;
  const out: IcsEvent[] = [];
  for (const e of d.exams.filter((x) => inRange(x.date))) {
    const base = { uid: `exam-${e.id}@studypulse`, summary: `Exam: ${e.title}${name(e.subjectId) ? ` (${name(e.subjectId)})` : ""}`,
      location: [e.room && `Room ${e.room}`, e.seat && `Seat ${e.seat}`].filter(Boolean).join(", ") || undefined, description: e.notes };
    out.push(e.startTime ? { ...base, start: at(e.date, e.startTime), end: at(e.date, e.startTime) + (e.durationMinutes ?? 60) * 60_000 } : { ...base, date: e.date });
  }
  for (const t of d.tasks.filter((x) => !x.completed && inRange(x.dueDate))) {
    const label = t.kind === "homework" ? "Homework" : t.kind === "revision" ? "Revision" : "Task";
    const base = { uid: `task-${t.id}@studypulse`, summary: `${label}: ${t.title}`, description: name(t.subjectId) };
    out.push(t.dueTime ? { ...base, start: at(t.dueDate!, t.dueTime), end: at(t.dueDate!, t.dueTime) + 30 * 60_000 } : { ...base, date: t.dueDate });
  }
  for (const b of d.blocks.filter((x) => inRange(x.date))) {
    out.push({ uid: `block-${b.id}@studypulse`, summary: `Study: ${b.title}`, start: at(b.date, b.start), end: at(b.date, b.start) + (toMinutes(b.end) - toMinutes(b.start)) * 60_000, description: name(b.subjectId) });
  }
  for (const o of classOccurrences(d.classes, d.timetable, from, to)) {
    out.push({ uid: `class-${o.classId}-${o.date}-${o.start.replace(":", "")}@studypulse`, summary: `Class: ${name(o.subjectId) ?? "Class"}${o.title ? ` (${o.title})` : ""}`,
      start: at(o.date, o.start), end: at(o.date, o.end), location: o.room ? `Room ${o.room}` : undefined, description: o.teacher });
  }
  return out;
}
