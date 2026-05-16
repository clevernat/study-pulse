"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTimerStore } from "@/store/timerStore";
import { subscribeTasks, subscribeSubjects, updateTask } from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import type { Task, Subject } from "@/types";

const PREVIEW_LIMIT = 3;

export default function TasksWidget() {
  const { user } = useAuth();
  const router = useRouter();
  const setSubject = useTimerStore((s) => s.setSubject);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeTasks(user.uid, setTasks);
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const open = tasks.filter((t) => !t.completed);
  const displayed = open
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, PREVIEW_LIMIT);
  const moreCount = open.length - displayed.length;

  function startTimerForTask(task: Task) {
    if (task.subjectId && task.subjectName) {
      setSubject(task.subjectId, task.subjectName);
      router.push(
        `/timer?subjectId=${encodeURIComponent(task.subjectId)}&subjectName=${encodeURIComponent(task.subjectName)}`
      );
    } else {
      router.push("/timer");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">
          Focus Tasks
          {open.length > 0 && (
            <span className="ml-2 text-sm font-normal text-on-surface-variant">({open.length} open)</span>
          )}
        </h2>
        <span className="text-xs text-on-surface-variant">
          Manage in <span className="text-primary">Tasks</span> ↑
        </span>
      </div>

      {open.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">checklist</span>
          <p className="text-sm text-on-surface font-inter mt-2">No open tasks</p>
          <p className="text-xs text-on-surface-variant mt-1">
            {tasks.length === 0
              ? "Add tasks from the toolbar to plan your study."
              : "All caught up — nice work."}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden divide-y divide-outline-variant/40">
          {displayed.map((task) => {
            const subjectColor = task.subjectId
              ? subjects.find((s) => s.id === task.subjectId)?.color
              : null;
            const dot = subjectColor ? getColor(subjectColor).dot : null;
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container/30 transition-colors group"
              >
                <button
                  type="button"
                  onClick={() => user && updateTask(user.uid, task.id, { completed: true })}
                  className="w-5 h-5 rounded border border-outline-variant hover:border-primary hover:bg-primary/10 transition-all flex-shrink-0"
                  aria-label="Mark complete"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-inter text-on-surface truncate">{task.title}</div>
                  {task.subjectName && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
                      <span className="text-[11px] text-on-surface-variant">{task.subjectName}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startTimerForTask(task)}
                  className="w-8 h-8 rounded-full border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-all flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title={task.subjectName ? `Study ${task.subjectName}` : "Open timer"}
                  aria-label="Start timer for this task"
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    play_arrow
                  </span>
                </button>
              </div>
            );
          })}
          {moreCount > 0 && (
            <div className="px-4 py-2 text-xs text-on-surface-variant text-center">
              + {moreCount} more open task{moreCount === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
