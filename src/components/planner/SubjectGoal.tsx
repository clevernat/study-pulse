"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/firebase/useCollection";
import { goalHours } from "@/lib/insights";
import { formatSmartDuration, localDateStr } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import GoalModal from "@/components/ui/GoalModal";
import type { Goal, Session, Subject } from "@/types";

/** On a subject's page, after its topics: the goal for this subject, and Start studying (the timer needs the goal). */
export default function SubjectGoal({ subject, subjects, sessions }: { subject: Subject; subjects: Subject[]; sessions: Session[] }) {
  const { user } = useAuth();
  const { items: goals } = useCollection<Goal>("goals");
  const [open, setOpen] = useState(false);
  const today = localDateStr();
  const active = goals.filter((g) => g.subjectId === subject.id && !g.completed && g.deadline >= today);
  const timer = `/timer?subjectId=${encodeURIComponent(subject.id)}&subjectName=${encodeURIComponent(subject.name)}`;

  return (
    <section data-testid="subject-goal" className="glass-card p-5 flex flex-col gap-4">
      <h2 className="font-grotesk font-bold text-lg text-on-surface flex items-center gap-2">
        <span aria-hidden="true" className="material-symbols-outlined text-primary">flag</span>Goal
      </h2>
      {active.length === 0 ? (
        <>
          <p className="text-sm text-on-surface-variant">Set a goal for {subject.name} (how many hours, by when). The timer starts after that.</p>
          <button type="button" data-testid="subject-goal-set" onClick={() => setOpen(true)}
            className="self-start px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:opacity-90">Set a goal</button>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {active.map((g) => {
              const h = goalHours(g, sessions);
              const pct = Math.min(100, Math.round((h / g.targetHours) * 100));
              return (
                <li key={g.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-on-surface font-semibold truncate">{g.title}</span>
                    <span className="text-xs text-on-surface-variant whitespace-nowrap">by {new Date(g.deadline + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#292b30] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: getColor(subject.color).dot }} /></div>
                  <span className="text-xs text-on-surface-variant">{formatSmartDuration(Math.round(h * 60))} of {formatSmartDuration(g.targetHours * 60)}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-4 flex-wrap">
            <Link href={timer} data-testid="subject-goal-start" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:opacity-90">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>Start studying
            </Link>
            <button type="button" onClick={() => setOpen(true)} className="text-sm text-primary font-semibold hover:underline">+ Another goal</button>
          </div>
        </>
      )}
      {open && user && (
        <GoalModal uid={user.uid} subjects={subjects} initialSubjectId={subject.id}
          onClose={() => setOpen(false)} onSave={() => setOpen(false)} onUpdate={() => setOpen(false)} />
      )}
    </section>
  );
}
