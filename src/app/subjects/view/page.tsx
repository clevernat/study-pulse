"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCollection } from "@/lib/firebase/useCollection";
import { getColor } from "@/lib/colorPalette";
import { localDateStr } from "@/lib/dateUtils";
import { examProgress, upcomingExams } from "@/lib/exams";
import TopicList from "@/components/planner/TopicList";
import ExamCard from "@/components/planner/ExamCard";
import ExamModal from "@/components/planner/ExamModal";
import { secondaryBtnCls } from "@/components/ui/Field";
import type { Deck, Exam, Subject, Task, Topic } from "@/types";
import DeckModal from "@/components/flashcards/DeckModal";

function SubjectView() {
  const id = useSearchParams().get("id") ?? "";
  const { items: subjects, loading, uid } = useCollection<Subject>("subjects");
  const { items: topics } = useCollection<Topic>("topics");
  const { items: exams } = useCollection<Exam>("exams");
  const { items: tasks } = useCollection<Task>("tasks");
  const [editing, setEditing] = useState<Exam | "new" | null>(null);
  const { items: decks } = useCollection<Deck>("decks");
  const [newDeck, setNewDeck] = useState(false);
  const subject = subjects.find((s) => s.id === id);
  const today = localDateStr();

  if (loading) return null;
  if (!subject) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-on-surface">This subject does not exist.</p>
        <Link href="/subjects" className="text-primary underline text-sm">Back to Subjects</Link>
      </div>
    );
  }
  const c = getColor(subject.color);
  const subjectExams = upcomingExams(exams.filter((e) => e.subjectId === id), today);

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/subjects" aria-label="Back to Subjects" className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
          <span className="material-symbols-outlined" style={{ color: c.text }}>{subject.icon}</span>
        </div>
        <div className="min-w-0">
          <h1 data-testid="subject-name" className="font-grotesk font-bold text-2xl text-on-surface truncate">{subject.name}</h1>
          <p className="text-xs" style={{ color: c.chipText }}>{subject.category}</p>
        </div>
      </div>

      <TopicList uid={uid} subjectId={id} topics={topics} exams={exams} barColor={c.bar} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-grotesk font-bold text-lg text-on-surface">Exams</h2>
          <button onClick={() => setEditing("new")} className={secondaryBtnCls}>
            <span className="material-symbols-outlined text-[18px]">add</span>Add exam
          </button>
        </div>
        {subjectExams.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No upcoming exams for this subject.</p>
        ) : subjectExams.map((e) => (
          <ExamCard key={e.id} exam={e} subject={subject} today={today} progress={examProgress(e.id, topics, tasks)} onEdit={() => setEditing(e)} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-grotesk font-bold text-lg text-on-surface">Flashcard decks</h2>
          <button onClick={() => setNewDeck(true)} className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">add</span>New deck</button>
        </div>
        {decks.filter((d) => d.subjectId === id).map((d) => (
          <Link key={d.id} href={`/flashcards/deck?id=${d.id}`} className="glass-card p-3 flex items-center gap-3 hover:border-primary/40">
            <span className="material-symbols-outlined" style={{ color: c.text }}>style</span>
            <span className="text-sm text-on-surface flex-1">{d.name}</span>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
          </Link>
        ))}
        {decks.every((d) => d.subjectId !== id) && <p className="text-sm text-on-surface-variant">No decks for this subject yet.</p>}
      </div>
      {newDeck && <DeckModal uid={uid} subjects={subjects} defaultSubjectId={id} onClose={() => setNewDeck(false)} />}

      {editing && (
        <ExamModal uid={uid} subjects={subjects} defaultSubjectId={id} exam={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

export default function SubjectViewPage() {
  return <Suspense><SubjectView /></Suspense>;
}
