"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTimerStore } from "@/store/timerStore";
import {
  subscribeTasks,
  subscribeSubjects,
  addTask,
  updateTask,
  deleteTask,
} from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import type { Task, Subject } from "@/types";

type FilterKind = "all" | "open" | "done";
const FILTERS: { id: FilterKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
];

export default function TasksPopover({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const setSubject = useTimerStore((s) => s.setSubject);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [draft, setDraft] = useState("");
  const [draftSubjectId, setDraftSubjectId] = useState<string>("");
  const [filter, setFilter] = useState<FilterKind>("open");
  const [saving, setSaving] = useState(false);

  function startTimerForTask(task: Task) {
    if (task.subjectId && task.subjectName) {
      setSubject(task.subjectId, task.subjectName);
      router.push(`/timer?subjectId=${encodeURIComponent(task.subjectId)}&subjectName=${encodeURIComponent(task.subjectName)}`);
    } else {
      router.push("/timer");
    }
    onClose();
  }

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeTasks(user.uid, setTasks);
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const filtered = tasks
    .filter((t) =>
      filter === "all" ? true : filter === "open" ? !t.completed : t.completed
    )
    .sort((a, b) => {
      // Open first, then by createdAt desc
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !draft.trim()) return;
    setSaving(true);
    const subject = subjects.find((s) => s.id === draftSubjectId);
    try {
      await addTask(user.uid, {
        uid: user.uid,
        title: draft.trim(),
        completed: false,
        ...(subject ? { subjectId: subject.id, subjectName: subject.name } : {}),
        createdAt: new Date().toISOString(),
      });
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  const openCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="fixed left-4 right-4 top-[72px] z-50 max-h-[calc(100vh-88px)] overflow-y-auto sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:max-h-none sm:overflow-visible sm:w-[360px] glass-card p-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-grotesk font-bold text-sm text-on-surface">
          Tasks {openCount > 0 && <span className="text-on-surface-variant font-normal">({openCount} open)</span>}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…"
          maxLength={120}
          className="bg-[#0e0e11] border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
          autoFocus
        />
        <div className="flex items-center gap-2">
          {subjects.length > 0 && (
            <select
              value={draftSubjectId}
              onChange={(e) => setDraftSubjectId(e.target.value)}
              className="flex-1 bg-[#0e0e11] border border-outline-variant rounded-lg px-2 py-1.5 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={!draft.trim() || saving}
            className="bg-primary-container text-on-primary-container px-3 py-1.5 rounded-lg font-semibold text-xs hover:opacity-80 transition-all disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-[11px] font-inter font-medium border transition-all ${
              filter === f.id
                ? "bg-primary text-on-primary border-primary"
                : "text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-on-surface-variant text-center py-6">
            {filter === "done"
              ? "No completed tasks yet."
              : tasks.length === 0
                ? "No tasks yet — add your first one above."
                : "Nothing here."}
          </p>
        ) : filtered.map((task) => {
          const subjectColor = task.subjectId
            ? subjects.find((s) => s.id === task.subjectId)?.color
            : null;
          const dot = subjectColor ? getColor(subjectColor).dot : null;
          return (
            <div
              key={task.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-low group"
            >
              <button
                type="button"
                onClick={() => user && updateTask(user.uid, task.id, { completed: !task.completed })}
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  task.completed
                    ? "bg-primary border-primary"
                    : "border-outline-variant hover:border-primary"
                }`}
                aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
              >
                {task.completed && (
                  <span className="material-symbols-outlined text-on-primary text-[12px]">check</span>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-inter truncate ${task.completed ? "line-through text-on-surface-variant" : "text-on-surface"}`}>
                  {task.title}
                </div>
                {task.subjectName && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
                    <span className="text-[10px] text-on-surface-variant">{task.subjectName}</span>
                  </div>
                )}
              </div>
              {!task.completed && (
                <button
                  type="button"
                  onClick={() => startTimerForTask(task)}
                  className="text-on-surface-variant hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Start timer for this task"
                  title={task.subjectName ? `Study ${task.subjectName}` : "Open timer"}
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => user && deleteTask(user.uid, task.id)}
                className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Delete task"
              >
                <span className="material-symbols-outlined text-[16px]">delete_outline</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
