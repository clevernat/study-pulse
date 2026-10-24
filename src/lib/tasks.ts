import type { Task, TaskKind } from "@/types";
import { daysAgoStr } from "./dateUtils";

export const TASK_KINDS: { value: TaskKind; label: string; icon: string }[] = [
  { value: "task", label: "Task", icon: "task_alt" },
  { value: "homework", label: "Homework", icon: "assignment" },
  { value: "revision", label: "Revision", icon: "menu_book" },
];

export function kindOf(task: Pick<Task, "kind">): TaskKind {
  return task.kind ?? "task";
}

/**
 * A repeating revision task: when it is completed, the next copy is due
 * `repeatAfterDays` after the day it was finished (not after the old due date).
 * Returns null when the task does not repeat.
 */
export function nextRepeat(task: Task, finishedOn: Date): Omit<Task, "id"> | null {
  if (!task.repeatAfterDays || task.repeatAfterDays < 1) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = task;
  return {
    ...rest,
    completed: false,
    dueDate: daysAgoStr(-task.repeatAfterDays, finishedOn),
    createdAt: finishedOn.toISOString(),
  };
}

/** Sort key for "due" order: date + time, tasks without a date last. */
export function dueKey(task: Pick<Task, "dueDate" | "dueTime">): string {
  return task.dueDate ? `${task.dueDate}T${task.dueTime ?? "99:99"}` : "9999";
}
