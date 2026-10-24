"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { subscribeTasks, subscribeSubjects, subscribeSessions, subscribeGoals, updateTask } from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
import type { Task, Subject, Session, Goal, Exam } from "@/types";
import { useCollection } from "@/lib/firebase/useCollection";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { classOccurrences, holidayOn } from "@/lib/timetable";
import { blockMinutes, blockDone } from "@/lib/calendar";
import { startBlockTimer } from "@/components/planner/BlockModal";
import type { StudyBlock, Habit } from "@/types";
import HabitRow from "@/components/planner/HabitRow";
import { useStudyCards } from "@/lib/firebase/useFlashcards";
import { buildQueue } from "@/lib/flashcards/queue";
import { useHabitContext } from "@/lib/firebase/useHabitContext";
import type { ClassItem } from "@/types";
import { upcomingExams, daysUntil, countdownLabel, urgency, URGENCY_CLASSES } from "@/lib/exams";
import StatRow from "@/components/ui/StatRow";

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
  const { items: exams } = useCollection<Exam>("exams");
  const { items: classes } = useCollection<ClassItem>("classes");
  const { settings: timetable } = useTimetable();
  const classesToday = classOccurrences(classes, timetable, today, today);
  const holidayToday = holidayOn(today, timetable.holidays);
  const { items: blocks } = useCollection<StudyBlock>("studyBlocks");
  const { items: habits } = useCollection<Habit>("habits");
  const habitCtx = useHabitContext();
  const fc = useStudyCards();
  const fcQueue = buildQueue(fc.cards, fc.decks, fc.logsToday, new Date(), today);
  const fcDue = fcQueue.counts.learning + fcQueue.counts.review + fcQueue.counts.new;
  const activeHabits = habits.filter((h) => !h.archived);
  const blocksToday = blocks.filter((b) => b.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const examsSoon = upcomingExams(exams, today).filter((e) => daysUntil(e.date, today) <= 14);

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
    <div className="max-w-2xl flex flex-col gap-8">

      {/* Greeting */}
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-on-surface">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">Here&apos;s what&apos;s on your plate today.</p>
      </div>

      <StatRow stats={[
        { label: "Focused today", value: todayMins > 0 ? formatSmartDuration(todayMins) : "0 min" },
        { label: "Tasks done today", value: `${tasksDone}/${tasksDone + tasksLeft}` },
        { label: "Open tasks", value: openCount },
      ]} />

      {/* Classes today (from the timetable) */}
      {(classesToday.length > 0 || holidayToday) && (
        <section data-testid="today-classes" className="flex flex-col gap-2">
          <h2 className="text-xs text-on-surface-variant font-bold">Classes today</h2>
          {holidayToday && <p className="text-sm text-tertiary">{holidayToday.name}: no classes.</p>}
          {classesToday.map((o, i) => {
            const sub = subjects.find((x) => x.id === o.subjectId);
            return (
              <div key={i} className="glass-card p-3 flex items-center gap-3">
                <span className="font-jetbrains text-xs text-on-surface-variant w-[88px]">{o.start}–{o.end}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: getColor(sub?.color ?? "violet").dot }} />
                <span className="text-sm text-on-surface flex-1 truncate">{sub?.name ?? "Class"}{o.title ? ` · ${o.title}` : ""}</span>
                {o.room && <span className="text-[11px] text-on-surface-variant">Room {o.room}</span>}
              </div>
            );
          })}
        </section>
      )}

      {/* Flashcards due today */}
      {fc.decks.length > 0 && (
        <section data-testid="today-flashcards" className="glass-card p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">style</span>
          <div className="flex-1">
            <p className="text-sm text-on-surface">{fcDue > 0 ? `${fcDue} flashcard${fcDue === 1 ? "" : "s"} to study` : "Flashcards done for today"}</p>
            <p className="text-[11px] text-on-surface-variant font-jetbrains">{fcQueue.counts.review} due · {fcQueue.counts.learning} learning · {fcQueue.counts.new} new</p>
          </div>
          {fcDue > 0 && <button onClick={() => router.push("/flashcards/review")} className="px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">Study</button>}
        </section>
      )}

      {/* Planned study blocks for today */}
      {blocksToday.length > 0 && (
        <section data-testid="today-blocks" className="flex flex-col gap-2">
          <h2 className="text-xs text-on-surface-variant font-bold">Planned study</h2>
          {blocksToday.map((b) => {
            const sub = subjects.find((x) => x.id === b.subjectId);
            const done = blockDone(b);
            return (
              <div key={b.id} className={`glass-card p-3 flex items-center gap-3 ${done ? "opacity-60" : ""}`}>
                <span className="font-jetbrains text-xs text-on-surface-variant w-[88px]">{b.start}–{b.end}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: getColor(sub?.color ?? "violet").dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">{b.title}</p>
                  <p className="text-[11px] text-on-surface-variant">{b.minutesDone ?? 0}/{blockMinutes(b)} min</p>
                </div>
                {done ? (
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                ) : sub && (
                  <button data-testid="today-block-start" onClick={() => { if (b.deckId) { router.push(`/flashcards/review?deck=${b.deckId}&block=${b.id}`); return; } startBlockTimer(b, subjects); router.push("/timer"); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>Start
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Habits */}
      {activeHabits.length > 0 && user && (
        <section data-testid="today-habits" className="flex flex-col gap-2">
          <h2 className="text-xs text-on-surface-variant font-bold">Habits</h2>
          {activeHabits.map((h) => <HabitRow key={h.id} uid={user.uid} habit={h} today={today} ctx={habitCtx} />)}
        </section>
      )}

      {/* Exams in the next 14 days */}
      {examsSoon.length > 0 && (
        <section data-testid="today-exams" className="flex flex-col gap-2">
          <h2 className="text-xs text-on-surface-variant font-bold">Exams soon</h2>
          {examsSoon.map((e) => {
            const days = daysUntil(e.date, today);
            const sub = subjects.find((x) => x.id === e.subjectId);
            return (
              <div key={e.id} className="glass-card p-3 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full" style={{ background: getColor(sub?.color ?? "violet").dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">{e.title}</p>
                  <p className="text-[11px] text-on-surface-variant">{sub?.name}{e.startTime ? ` · ${e.startTime}` : ""}{e.room ? ` · Room ${e.room}` : ""}</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-jetbrains ${URGENCY_CLASSES[urgency(days)]}`}>{countdownLabel(days)}</span>
              </div>
            );
          })}
        </section>
      )}

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
          Due today {dueTodayTasks.length > 0 && `(${dueTodayTasks.length})`}
        </h2>
        {dueTodayTasks.length === 0 ? (
          <div className="glass-card p-5 text-center text-on-surface-variant text-sm">
            Nothing due today. {openCount > 0 ? `You have ${openCount} open ${openCount === 1 ? "task" : "tasks"}.` : "Add tasks in Plan → Tasks."}
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
          Sessions today ({todaySessions.length})
        </h2>
        {todaySessions.length === 0 ? (
          <div className="glass-card p-5 flex flex-col items-center gap-3 text-center">
            <p className="text-on-surface-variant text-sm">No sessions yet today.</p>
            <button
              onClick={() => router.push("/timer")}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:opacity-90 transition-all"
            >
              Start a focus session
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
                    {days === 0 ? "Due today" : `${days}d left`}
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
      <button type="button" onClick={onToggle} aria-pressed={task.completed} aria-label={`${task.completed ? "Mark not done" : "Mark done"}: ${task.title}`}
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
