import type { Exam, Topic, Task } from "@/types";

/** Whole days from `today` to `date` (both "YYYY-MM-DD"). Negative = in the past. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
}

export type Urgency = "past" | "today" | "red" | "amber" | "green";

/** Colour band for a countdown: under 7 days red, 7–14 amber, more green. */
export function urgency(days: number): Urgency {
  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days < 7) return "red";
  if (days <= 14) return "amber";
  return "green";
}

export function countdownLabel(days: number): string {
  if (days < 0) return days === -1 ? "Yesterday" : `${-days} days ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days left`;
}

export const URGENCY_CLASSES: Record<Urgency, string> = {
  past: "text-on-surface-variant bg-surface-container",
  today: "text-error bg-error/15",
  red: "text-error bg-error/10",
  amber: "text-tertiary bg-tertiary/10",
  green: "text-secondary bg-secondary/10",
};

/** Upcoming exams (today or later), soonest first. */
export function upcomingExams(exams: Exam[], today: string, limit = Infinity): Exam[] {
  return exams
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""))
    .slice(0, limit);
}

export interface Progress { done: number; total: number; pct: number }

function progress(done: number, total: number): Progress {
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Checked topics of a subject. */
export function topicProgress(topics: Topic[], subjectId: string): Progress {
  const list = topics.filter((t) => t.subjectId === subjectId);
  return progress(list.filter((t) => t.done).length, list.length);
}

/** Revision progress for an exam: its linked topics and linked tasks. */
export function examProgress(examId: string, topics: Topic[], tasks: Task[]): Progress {
  const items = [
    ...topics.filter((t) => t.examId === examId).map((t) => t.done),
    ...tasks.filter((t) => t.examId === examId).map((t) => t.completed),
  ];
  return progress(items.filter(Boolean).length, items.length);
}
