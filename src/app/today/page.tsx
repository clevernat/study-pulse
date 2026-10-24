"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { subscribeTasks, subscribeSubjects, subscribeSessions, subscribeGoals, updateTask } from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
import type { Task, Subject, Session, Goal } from "@/types";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function TodayPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [tasks, setTasks]       = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals]       = useState<Goal[]>([]);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeTasks(user.uid, setTasks);
    const u2 = subscribeSubjects(user.uid, setSubjects);
    const u3 = subscribeSessions(user.uid, setSessions);
    const u4 = subscribeGoals(user.uid, setGoals);
    return () => { u1(); u2(); u3(); u4(); };
  }, [user]);

  const today = localDateStr();

  // ── Derived data ────────────────────────────────────────────────────────────
  const dueTodayTasks = useMemo(() =>
    tasks.filter((t) => !t.completed && t.dueDate === today)
      .sort((a, b) => (PRIORITY_ORDER[a.priority ?? "low"] ?? 2) - (PRIORITY_ORDER[b.priority ?? "low"] ?? 2))
  , [tasks, today]);

  const overdueTasks = useMemo(() =>
    tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
  , [tasks, today]);

  const todaySessions = useMemo(() =>
    sessions.filter((s) => s.date === today)
      .sort((a, b) => b.startTime.localeCompare(a.startTime))
  , [sessions, today]);

  const upcomingDeadlines = useMemo(() => {
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);
    const cutoff = localDateStr(sevenDays);
    return goals
      .filter((g) => !g.completed && g.deadline >= today && g.deadline <= cutoff)
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [goals, today]);

  const todayMins   = todaySessions.reduce((s, ses) => s + ses.durationMinutes, 0);
  const tasksLeft   = dueTodayTasks.filter((t) => !t.completed).length;
  const tasksDone   = tasks.filter((t) => t.completed && t.dueDate === today).length;
  const openCount   = tasks.filter((t) => !t.completed).length;

  function daysLeft(deadline: string) {
    return Math.ceil((new Date(deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  }

  function focusColor(score: number) {
    if (score >= 90) return "text-secondary";
    if (score >= 75) return "text-tertiary";
    return "text-error";
  }

  const PRIORITY_COLORS = {
    high:   { bg: "bg-error/10",     text: "text-error",     border: "border-error/30" },
    medium: { bg: "bg-tertiary/10",  text: "text-tertiary",  border: "border-tertiary/30" },
    low:    { bg: "bg-secondary/10", text: "text-secondary", border: "border-secondary/30" },
  } as const;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">

      {/* Greeting */}
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-on-surface">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">Here&apos;s what&apos;s on your plate today.</p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="glass-card px-5 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
          <div>
            <div className="font-jetbrains font-bold text-lg text-on-surface">{todayMins > 0 ? formatSmartDuration(todayMins) : "0 min"}</div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">Focused today</div>
          </div>
        </div>
        <div className="glass-card px-5 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
          <div>
            <div className="font-jetbrains font-bold text-lg text-on-surface">{tasksDone}/{tasksDone + tasksLeft}</div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">Tasks done today</div>
          </div>
        </div>
        <div className="glass-card px-5 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>checklist</span>
          <div>
            <div className="font-jetbrains font-bold text-lg text-on-surface">{openCount}</div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">Open tasks</div>
          </div>
        </div>
      </div>

      {/* Overdue tasks — show first, most urgent */}
      {overdueTasks.length > 0 && (
        <section>
          <h2 className="font-grotesk font-bold text-base text-error mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            Overdue ({overdueTasks.length})
          </h2>
          <div className="flex flex-col gap-2">
            {overdueTasks.map((task) => {
              const sub = subjects.find((s) => s.id === task.subjectId);
              const c = sub ? getColor(sub.color) : null;
              const daysAgo = Math.abs(daysLeft(task.dueDate!));
              return (
                <TaskRow key={task.id} task={task} sub={sub} c={c}
                  badge={`${daysAgo}d overdue`} badgeCls="text-error"
                  onToggle={() => user && updateTask(user.uid, task.id, { completed: !task.completed })}
                  onTimer={() => router.push(sub ? `/timer?subjectId=${sub.id}&subjectName=${encodeURIComponent(sub.name)}` : "/timer")}
                  priorityColors={PRIORITY_COLORS}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Tasks due today */}
      <section>
        <h2 className="font-grotesk font-bold text-base text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>today</span>
          Due Today {dueTodayTasks.length > 0 && `(${dueTodayTasks.length})`}
        </h2>
        {dueTodayTasks.length === 0 ? (
          <div className="glass-card p-5 text-center text-on-surface-variant text-sm">
            Nothing due today. {openCount > 0 ? `You have ${openCount} open tasks.` : "Add tasks in the Task Planner."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {dueTodayTasks.map((task) => {
              const sub = subjects.find((s) => s.id === task.subjectId);
              const c = sub ? getColor(sub.color) : null;
              return (
                <TaskRow key={task.id} task={task} sub={sub} c={c}
                  badge="Due today" badgeCls="text-tertiary"
                  onToggle={() => user && updateTask(user.uid, task.id, { completed: !task.completed })}
                  onTimer={() => router.push(sub ? `/timer?subjectId=${sub.id}&subjectName=${encodeURIComponent(sub.name)}` : "/timer")}
                  priorityColors={PRIORITY_COLORS}
                />
              );
            })}
          </div>
        )}
        <button
          onClick={() => router.push("/tasks")}
          className="mt-3 text-sm text-primary hover:opacity-80 transition-opacity"
        >
          View all tasks →
        </button>
      </section>

      {/* Today's sessions */}
      <section>
        <h2 className="font-grotesk font-bold text-base text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
          Sessions Today ({todaySessions.length})
        </h2>
        {todaySessions.length === 0 ? (
          <div className="glass-card p-5 flex flex-col items-center gap-3 text-center">
            <p className="text-on-surface-variant text-sm">No sessions yet today.</p>
            <button
              onClick={() => router.push("/timer")}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:opacity-90 transition-all"
            >
              Start a Focus Session
            </button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            {todaySessions.map((s, i) => {
              const sub = subjects.find((sub) => sub.id === s.subjectId);
              const c = sub ? getColor(sub.color) : null;
              return (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-outline-variant/50" : ""}`}>
                  {c && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-inter font-medium text-on-surface truncate">{s.subjectName}</p>
                    {s.sessionType && s.sessionType !== "Deep Work" && (
                      <p className="text-[10px] text-on-surface-variant">{s.sessionType}</p>
                    )}
                  </div>
                  <span className="text-xs font-jetbrains text-on-surface-variant">{s.startTime} – {s.endTime}</span>
                  <span className="text-xs font-jetbrains text-on-surface-variant">{formatSmartDuration(s.durationMinutes)}</span>
                  <span className={`text-xs font-jetbrains font-bold ${focusColor(s.focusScore)}`}>{s.focusScore}%</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 && (
        <section>
          <h2 className="font-grotesk font-bold text-base text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
            Deadlines This Week
          </h2>
          <div className="flex flex-col gap-2">
            {upcomingDeadlines.map((goal) => {
              const days = daysLeft(goal.deadline);
              const urgent = days <= 2;
              return (
                <div key={goal.id} className={`glass-card p-4 flex items-center gap-3 ${urgent ? "border-error/25" : ""}`}>
                  <span className={`material-symbols-outlined text-[20px] ${urgent ? "text-error" : "text-tertiary"}`} style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-inter font-medium text-on-surface truncate">{goal.title}</p>
                    {goal.subjectName && <p className="text-[10px] text-on-surface-variant mt-0.5">{goal.subjectName}</p>}
                  </div>
                  <span className={`text-xs font-bold font-jetbrains ${urgent ? "text-error" : "text-tertiary"}`}>
                    {days === 0 ? "Due today!" : `${days}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}

// ── Shared task row component ─────────────────────────────────────────────────

function TaskRow({
  task, sub, c, badge, badgeCls, onToggle, onTimer, priorityColors,
}: {
  task: Task;
  sub: Subject | undefined;
  c: ReturnType<typeof getColor> | null;
  badge: string;
  badgeCls: string;
  onToggle: () => void;
  onTimer: () => void;
  priorityColors: Record<string, { bg: string; text: string; border: string }>;
}) {
  return (
    <div className={`glass-card p-4 flex items-start gap-3 ${task.completed ? "opacity-50" : ""}`}>
      <button type="button" onClick={onToggle}
        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          task.completed ? "bg-primary border-primary" : "border-outline-variant hover:border-primary"
        }`}>
        {task.completed && <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-inter text-sm font-medium ${task.completed ? "line-through text-on-surface-variant" : "text-on-surface"}`}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {sub && c && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.chip, color: c.chipText }}>
              {sub.name}
            </span>
          )}
          {task.priority && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColors[task.priority]?.bg} ${priorityColors[task.priority]?.text} ${priorityColors[task.priority]?.border}`}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          )}
          <span className={`text-[10px] font-medium ${badgeCls}`}>{badge}</span>
          {task.estimatedMinutes && (
            <span className="text-[10px] text-on-surface-variant">{task.estimatedMinutes}m est.</span>
          )}
        </div>
      </div>
      {!task.completed && (
        <button onClick={onTimer}
          className="text-on-surface-variant hover:text-primary transition-colors p-1 flex-shrink-0"
          title="Start timer for this task">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
        </button>
      )}
    </div>
  );
}
