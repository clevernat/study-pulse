"use client";
import { useState } from "react";
import { useCollection } from "@/lib/firebase/useCollection";
import { localDateStr } from "@/lib/dateUtils";
import { examProgress, upcomingExams } from "@/lib/exams";
import ExamModal from "@/components/planner/ExamModal";
import ExamCard from "@/components/planner/ExamCard";
import { EmptyState, primaryBtnCls } from "@/components/ui/Field";
import type { ClassItem, Exam, Subject, Task, Topic } from "@/types";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { findClashes } from "@/lib/timetable";

export default function ExamsPage() {
  const { items: exams, uid } = useCollection<Exam>("exams");
  const { items: subjects } = useCollection<Subject>("subjects");
  const { items: topics } = useCollection<Topic>("topics");
  const { items: tasks } = useCollection<Task>("tasks");
  const [editing, setEditing] = useState<Exam | "new" | null>(null);
  const [showPast, setShowPast] = useState(false);
  const today = localDateStr();
  const { items: classes } = useCollection<ClassItem>("classes");
  const { settings } = useTimetable();
  const clashes = findClashes(exams.filter((e) => e.date >= today), classes, settings);
  const clashText = (e: Exam) => {
    const c = clashes.find((x) => x.exam.id === e.id);
    if (!c) return undefined;
    const sub = subjects.find((s) => s.id === c.occurrence.subjectId);
    return `Clashes with ${sub?.name ?? "a class"} ${c.occurrence.start}–${c.occurrence.end}`;
  };

  const upcoming = upcomingExams(exams, today);
  const past = exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const card = (e: Exam) => (
    <ExamCard key={e.id} exam={e} subject={subjects.find((s) => s.id === e.subjectId)} today={today}
      progress={examProgress(e.id, topics, tasks)} onEdit={() => setEditing(e)} warning={clashText(e)} />
  );

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant">{upcoming.length} upcoming · {past.length} past</p>
        <button data-testid="exam-new" onClick={() => setEditing("new")} className={primaryBtnCls}>
          <span className="material-symbols-outlined text-[18px]">add</span>New exam
        </button>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState icon="event_upcoming" title="No upcoming exams" text={subjects.length === 0 ? "Add a subject first, then add your exams." : "Add an exam to see a countdown and track your revision."} />
      ) : (
        <div className="flex flex-col gap-3">{upcoming.map(card)}</div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <button onClick={() => setShowPast((v) => !v)} className="self-start text-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">{showPast ? "expand_less" : "expand_more"}</span>
            Past exams ({past.length})
          </button>
          {showPast && past.map(card)}
        </div>
      )}

      {editing && (
        <ExamModal uid={uid} subjects={subjects} exam={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
