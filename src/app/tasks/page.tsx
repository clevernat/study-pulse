"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeTasks, subscribeSubjects, addTask, updateTask, deleteTask } from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import { localDateStr } from "@/lib/dateUtils";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { Task, Subject, Exam, TaskKind } from "@/types";
import { useCollection } from "@/lib/firebase/useCollection";
import { TASK_KINDS, kindOf, nextRepeat, dueKey } from "@/lib/tasks";
import { REMINDER_OPTIONS } from "@/components/ui/Field";

type FilterKind = "all" | "today" | "overdue" | "done";
type SortKind  = "due" | "priority" | "created";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, undefined: 3 };
const PRIORITY_COLORS = {
  high:   { bg: "bg-error/10",     text: "text-error",     border: "border-error/30",     label: "High" },
  medium: { bg: "bg-tertiary/10",  text: "text-tertiary",  border: "border-tertiary/30",  label: "Medium" },
  low:    { bg: "bg-secondary/10", text: "text-secondary", border: "border-secondary/30", label: "Low" },
};

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter]     = useState<FilterKind>("all");
  const [sort, setSort]         = useState<SortKind>("due");
  const [kindFilter, setKindFilter] = useState<TaskKind | "">("");
  const { items: exams } = useCollection<Exam>("exams");
  const [showForm, setShowForm] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle]       = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate]   = useState("");
  const [priority, setPriority] = useState<Task["priority"]>(undefined);
  const [estMins, setEstMins]   = useState("");
  const [kind, setKind]         = useState<TaskKind>("task");
  const [dueTime, setDueTime]   = useState("");
  const [examId, setExamId]     = useState("");
  const [repeatDays, setRepeatDays] = useState("");
  const [reminder, setReminder] = useState("");
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeTasks(user.uid, setTasks);
    const u2 = subscribeSubjects(user.uid, setSubjects);
    return () => { u1(); u2(); };
  }, [user]);

  const today = localDateStr();

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (filter === "today")   list = list.filter((t) => !t.completed && t.dueDate === today);
    if (filter === "overdue") list = list.filter((t) => !t.completed && t.dueDate && t.dueDate < today);
    if (filter === "done")    list = list.filter((t) => t.completed);
    if (filter === "all")     list = list.filter((t) => !t.completed);
    if (kindFilter)           list = list.filter((t) => kindOf(t) === kindFilter);

    list.sort((a, b) => {
      if (sort === "priority") {
        const pa = PRIORITY_ORDER[(a.priority ?? "undefined") as keyof typeof PRIORITY_ORDER];
        const pb = PRIORITY_ORDER[(b.priority ?? "undefined") as keyof typeof PRIORITY_ORDER];
        if (pa !== pb) return pa - pb;
      }
      if (sort === "due" || sort === "priority") {
        const ka = dueKey(a), kb = dueKey(b);
        if (ka !== kb) return ka.localeCompare(kb);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  }, [tasks, filter, sort, today, kindFilter]);

  const counts = useMemo(() => ({
    all:     tasks.filter((t) => !t.completed).length,
    today:   tasks.filter((t) => !t.completed && t.dueDate === today).length,
    overdue: tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today).length,
    done:    tasks.filter((t) => t.completed).length,
  }), [tasks, today]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    const sub = subjects.find((s) => s.id === subjectId);
    try {
      await addTask(user.uid, {
        uid: user.uid,
        title: title.trim(),
        completed: false,
        ...(sub ? { subjectId: sub.id, subjectName: sub.name } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(priority ? { priority } : {}),
        ...(estMins && !isNaN(parseInt(estMins)) ? { estimatedMinutes: parseInt(estMins) } : {}),
        kind,
        ...(dueDate && dueTime ? { dueTime } : {}),
        ...(examId ? { examId } : {}),
        ...(repeatDays && parseInt(repeatDays) > 0 ? { repeatAfterDays: Math.min(365, parseInt(repeatDays)) } : {}),
        ...(dueDate && reminder !== "" ? { reminderMinutesBefore: parseInt(reminder) } : {}),
        createdAt: new Date().toISOString(),
      });
      setTitle(""); setSubjectId(""); setDueDate(""); setPriority(undefined); setEstMins("");
      setKind("task"); setDueTime(""); setExamId(""); setRepeatDays(""); setReminder("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: Task) {
    if (!user) return;
    await updateTask(user.uid, task.id, { completed: !task.completed });
    const next = !task.completed ? nextRepeat(task, new Date()) : null;
    if (next) await addTask(user.uid, { ...next, repeatAfterDays: task.repeatAfterDays });
  }

  async function handleDelete(id: string) {
    if (!user) return;
    setDeletingId(id);
    try { await deleteTask(user.uid, id); } finally { setDeletingId(null); setConfirmId(null); }
  }

  function daysLabel(dueDate: string): { text: string; cls: string } {
    const diff = Math.ceil((new Date(dueDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: "text-error" };
    if (diff === 0) return { text: "Due today", cls: "text-tertiary" };
    if (diff <= 3) return { text: `${diff}d left`, cls: "text-tertiary" };
    return { text: `${diff}d left`, cls: "text-on-surface-variant" };
  }

  const FILTERS: { id: FilterKind; label: string }[] = [
    { id: "all",     label: `Open (${counts.all})` },
    { id: "today",   label: `Today (${counts.today})` },
    { id: "overdue", label: `Overdue (${counts.overdue})` },
    { id: "done",    label: `Done (${counts.done})` },
  ];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <ConfirmModal
        open={!!confirmId}
        title="Delete Task"
        description="Delete this task? This cannot be undone."
        confirmLabel={deletingId ? "Deleting…" : "Delete"}
        cancelLabel="Cancel"
        destructive
        icon="delete_forever"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#958da1]">{counts.all} open · {counts.done} done</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          data-testid="task-new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Task
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="glass-card p-5 flex flex-col gap-4">
          <h3 className="font-grotesk font-bold text-on-surface">New Task</h3>

          <div className="flex gap-2" role="radiogroup" aria-label="Kind">
            {TASK_KINDS.map((k) => (
              <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} data-testid={`task-kind-${k.value}`}
                onClick={() => setKind(k.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${
                  kind === k.value ? "bg-primary/15 text-primary border-primary/50" : "border-outline-variant text-on-surface-variant hover:border-outline"
                }`}>
                <span className="material-symbols-outlined text-[16px]">{k.icon}</span>{k.label}
              </button>
            ))}
          </div>

          <input
            data-testid="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title…"
            autoFocus
            maxLength={200}
            className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
          />

          <div className="grid grid-cols-2 gap-3">
            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">None</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Due date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Due Date</label>
              <input
                data-testid="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
                style={{ colorScheme: "dark" }}
              />
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Priority</label>
              <div className="flex gap-2">
                {(["high","medium","low"] as Task["priority"][]).map((p) => {
                  const c = PRIORITY_COLORS[p!];
                  return (
                    <button key={p} type="button" onClick={() => setPriority(priority === p ? undefined : p)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all ${
                        priority === p ? `${c.bg} ${c.text} ${c.border}` : "border-outline-variant text-on-surface-variant hover:border-outline"
                      }`}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Estimated time */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Est. Time (min)</label>
              <input
                type="number"
                min="1" max="480"
                value={estMins}
                onChange={(e) => setEstMins(e.target.value)}
                placeholder="e.g. 30"
                className="bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
              />
            </div>

            {/* Due time + reminder (only with a due date) */}
            {dueDate && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Due Time</label>
                  <input type="time" data-testid="task-time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={{ colorScheme: "dark" }}
                    className="bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Reminder</label>
                  <select value={reminder} onChange={(e) => setReminder(e.target.value)}
                    className="bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors">
                    {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === "0" ? "At due time" : o.label}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Exam link + repeat (revision) */}
            {kind === "revision" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">For Exam</label>
                  <select data-testid="task-exam" value={examId} onChange={(e) => setExamId(e.target.value)}
                    className="bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="">None</option>
                    {exams.filter((ex) => ex.date >= today && (!subjectId || ex.subjectId === subjectId)).map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Repeat after done</label>
                  <select value={repeatDays} onChange={(e) => setRepeatDays(e.target.value)}
                    className="bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="">Do not repeat</option>
                    {[1, 2, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d === 1 ? "1 day later" : `${d} days later`}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all font-inter text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" data-testid="task-save" disabled={!title.trim() || saving}
              className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 rounded-full border-2 border-on-primary-container border-t-transparent animate-spin" />}
              Add Task
            </button>
          </div>
        </form>
      )}

      {/* Filters + Sort */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                filter === f.id
                  ? "bg-primary/20 text-primary border-primary/50"
                  : "border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Kind filter"
          data-testid="task-kind-filter"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as TaskKind | "")}
          className="bg-[#0e0e11] border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors ml-auto"
        >
          <option value="">All kinds</option>
          {TASK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKind)}
          className="bg-[#0e0e11] border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
        >
          <option value="due">Sort: Due Date</option>
          <option value="priority">Sort: Priority</option>
          <option value="created">Sort: Created</option>
        </select>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="glass-card p-10 flex flex-col items-center gap-3 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">task_alt</span>
            <p className="text-on-surface font-grotesk font-bold">
              {filter === "done" ? "No completed tasks yet" : filter === "overdue" ? "No overdue tasks" : filter === "today" ? "Nothing due today" : "All caught up!"}
            </p>
            <p className="text-sm text-on-surface-variant">
              {filter === "all" ? "Click \"New Task\" above to get started." : ""}
            </p>
          </div>
        ) : filtered.map((task) => {
          const sub = subjects.find((s) => s.id === task.subjectId);
          const c = sub ? getColor(sub.color) : null;
          const pColor = task.priority ? PRIORITY_COLORS[task.priority] : null;
          const dl = task.dueDate ? daysLabel(task.dueDate) : null;

          return (
            <div key={task.id} data-testid="task-item" className={`glass-card p-4 flex items-start gap-3 transition-all ${task.completed ? "opacity-50" : ""}`}>
              {/* Checkbox */}
              <button
                type="button"
                data-testid="task-check"
                onClick={() => toggleDone(task)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  task.completed ? "bg-primary border-primary" : "border-outline-variant hover:border-primary"
                }`}
                aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
              >
                {task.completed && <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`font-inter text-sm font-medium ${task.completed ? "line-through text-on-surface-variant" : "text-on-surface"}`}>
                  {task.title}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {kindOf(task) !== "task" && (
                    <span data-testid="task-kind-chip" className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[11px]">{TASK_KINDS.find((k) => k.value === kindOf(task))!.icon}</span>
                      {TASK_KINDS.find((k) => k.value === kindOf(task))!.label}
                    </span>
                  )}
                  {task.examId && exams.find((ex) => ex.id === task.examId) && (
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px]">event_upcoming</span>
                      {exams.find((ex) => ex.id === task.examId)!.title}
                    </span>
                  )}
                  {task.repeatAfterDays && (
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5" title="Repeats after you finish it">
                      <span className="material-symbols-outlined text-[12px]">repeat</span>{task.repeatAfterDays}d
                    </span>
                  )}
                  {/* Subject */}
                  {sub && c && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.chip, color: c.chipText }}>
                      <span className="material-symbols-outlined text-[11px]">{sub.icon}</span>
                      {sub.name}
                    </span>
                  )}

                  {/* Priority */}
                  {pColor && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pColor.bg} ${pColor.text} ${pColor.border}`}>
                      {pColor.label}
                    </span>
                  )}

                  {/* Due date */}
                  {dl && (
                    <span className={`text-[10px] font-medium ${dl.cls} flex items-center gap-0.5`}>
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      {dl.text}{task.dueTime ? ` · ${task.dueTime}` : ""}
                    </span>
                  )}

                  {/* Est time */}
                  {task.estimatedMinutes && (
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px]">timer</span>
                      {task.estimatedMinutes}m est.
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => setConfirmId(task.id)}
                disabled={deletingId === task.id}
                className="text-on-surface-variant/40 hover:text-error transition-colors p-1 flex-shrink-0"
                aria-label="Delete task"
              >
                <span className="material-symbols-outlined text-[18px]">delete_outline</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
