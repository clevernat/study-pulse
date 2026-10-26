"use client";
import { useLiveFocus } from "@/lib/liveFocus";
import StudyButton from "@/components/ui/StudyButton";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/firebase/useCollection";
import { goalHours } from "@/lib/insights";
import { getColor } from "@/lib/colorPalette";
import { formatSmartDuration, localDateStr } from "@/lib/dateUtils";
import GoalModal from "@/components/ui/GoalModal";
import { NewSubjectForm } from "@/components/ui/NewSubject";
import type { Goal, Session, Subject, Topic } from "@/types";

const btn = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-container text-on-primary-container text-sm font-bold hover:opacity-90";

/** First thing on Today: your goals, or the 4 steps to get there (subject → topic → goal → timer). */
export default function GoalsFirst({ goals, subjects, sessions }: { goals: Goal[]; subjects: Subject[]; sessions: Session[] }) {
  const { user } = useAuth();
  const { items: topics } = useCollection<Topic>("topics");
  const [newSubject, setNewSubject] = useState(false);
  const [goalFor, setGoalFor] = useState<string | null>(null); // subject id, "" = choose
  const live = useLiveFocus();
  const today = localDateStr();
  const active = goals.filter((g) => !g.completed && g.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline));

  const modal = goalFor !== null && user && (
    <GoalModal uid={user.uid} subjects={subjects} initialSubjectId={goalFor || undefined}
      onClose={() => setGoalFor(null)} onSave={() => setGoalFor(null)} onUpdate={() => setGoalFor(null)} />
  );

  if (active.length === 0) {
    const first = subjects[0];
    const steps = [
      { done: subjects.length > 0, title: "Create a subject", text: "What are you studying? For example Networking." },
      { done: topics.length > 0, title: "Add a topic", text: "The part you will study first, for example Subnetting." },
      { done: false, title: "Set a goal", text: "How many hours, and by when. The timer needs a goal." },
      { done: false, title: "Start the timer", text: "Your study time then counts toward your goal." },
    ];
    const current = steps.findIndex((s) => !s.done);
    return (
      <section data-testid="start-guide" className="glass-card p-5 flex flex-col gap-4 border-primary/40">
        <div>
          <h2 className="font-grotesk font-bold text-xl text-on-surface">Start here</h2>
          <p className="text-sm text-on-surface-variant">Four steps, then you are studying.</p>
        </div>
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.title} data-testid={`guide-step-${i + 1}`} data-state={s.done ? "done" : i === current ? "now" : "later"}
              className={`flex gap-3 rounded-xl p-3 border ${i === current ? "border-primary bg-primary/5" : "border-outline-variant"} ${s.done ? "opacity-70" : ""}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${s.done ? "bg-secondary text-black" : i === current ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-on-surface-variant"}`}>
                {s.done ? <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check</span> : i + 1}
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div>
                  <p className="font-semibold text-on-surface">{s.title}{i === 1 && <span className="text-xs text-on-surface-variant font-normal"> (optional)</span>}</p>
                  <p className="text-sm text-on-surface-variant">{s.text}</p>
                </div>
                {i === current && i === 0 && (newSubject
                  ? <NewSubjectForm onCreated={() => setNewSubject(false)} onCancel={() => setNewSubject(false)} />
                  : <button type="button" data-testid="guide-new-subject" onClick={() => setNewSubject(true)} className={`${btn} self-start`}>Create a subject</button>)}
                {i === current && i === 1 && first && (
                  <div className="flex gap-3 items-center flex-wrap">
                    <Link href={`/subjects/view/?id=${first.id}`} data-testid="guide-add-topic" className={btn}>Add a topic to {first.name}</Link>
                    <button type="button" onClick={() => setGoalFor(first.id)} className="text-sm text-on-surface-variant underline underline-offset-2">Skip, set a goal</button>
                  </div>
                )}
                {i === current && i === 2 && (
                  <button type="button" data-testid="guide-set-goal" onClick={() => setGoalFor(subjects.length === 1 ? first.id : "")} className={`${btn} self-start`}>Set a goal</button>
                )}
              </div>
            </li>
          ))}
        </ol>
        {modal}
      </section>
    );
  }

  return (
    <section data-testid="goals-first" className="glass-card p-5 flex flex-col gap-4 border-primary/40">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-grotesk font-bold text-xl text-on-surface flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary">flag</span>Your goals
        </h2>
        <button type="button" data-testid="goals-first-new" onClick={() => setGoalFor("")} className="text-sm text-primary font-semibold hover:underline">+ New goal</button>
      </div>
      <ul className="flex flex-col gap-4">
        {active.map((g) => {
          const sub = subjects.find((s) => s.id === g.subjectId);
          const hours = goalHours(g, sessions);
          const pct = Math.min(100, Math.round((hours / g.targetHours) * 100));
          const left = Math.round((Date.parse(g.deadline) - Date.parse(today)) / 86_400_000);
          return (
            <li key={g.id} data-testid="goals-first-item" className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getColor(sub?.color ?? "violet").dot }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface truncate">{g.title}</p>
                  <p className="text-xs text-on-surface-variant">{sub?.name ?? g.subjectName ?? "No subject"} · {left === 0 ? "due today" : `${left} day${left === 1 ? "" : "s"} left`}</p>
                  {live.active && live.subjectId === g.subjectId && (
                    <p data-testid="goals-first-now" className="text-xs text-secondary font-semibold">Studying now{live.topicTitle ? `: ${live.topicTitle}` : ""} · {live.minutes} min so far</p>
                  )}
                </div>
                {sub && (
                  <StudyButton subject={sub} testId="goals-first-start" />
                )}
              </div>
              <div className="h-2.5 rounded-full bg-[#292b30] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: getColor(sub?.color ?? "violet").dot }} /></div>
              <p className="text-xs text-on-surface-variant">{formatSmartDuration(Math.round(hours * 60))} of {formatSmartDuration(g.targetHours * 60)} · {pct}%</p>
            </li>
          );
        })}
      </ul>
      {modal}
    </section>
  );
}
