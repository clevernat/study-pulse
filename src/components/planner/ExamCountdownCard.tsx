"use client";
import Link from "next/link";
import { useCollection } from "@/lib/firebase/useCollection";
import { upcomingExams, daysUntil, countdownLabel, urgency, URGENCY_CLASSES, examProgress } from "@/lib/exams";
import { localDateStr } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import type { Exam, Subject, Topic, Task } from "@/types";

/** Dashboard card: the next exams with a day countdown and revision progress. */
export default function ExamCountdownCard({ subjects, tasks }: { subjects: Subject[]; tasks: Task[] }) {
  const { items: exams } = useCollection<Exam>("exams");
  const { items: topics } = useCollection<Topic>("topics");
  const today = localDateStr();
  const next = upcomingExams(exams, today, 3);

  return (
    <div className="glass-card p-6 flex flex-col gap-4" data-testid="exam-countdown">
      <div className="flex items-center justify-between">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Upcoming Exams</h2>
        <Link href="/exams" className="text-sm text-primary hover:opacity-80">All exams →</Link>
      </div>
      {next.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No exams planned. <Link href="/exams" className="text-primary underline">Add an exam</Link> to see a countdown here.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {next.map((exam) => {
            const days = daysUntil(exam.date, today);
            const subject = subjects.find((s) => s.id === exam.subjectId);
            const c = getColor(subject?.color ?? "violet");
            const prog = examProgress(exam.id, topics, tasks);
            return (
              <div key={exam.id} data-testid="exam-countdown-item" className="rounded-xl border border-outline-variant/60 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                  <span className="text-xs text-on-surface-variant truncate">{subject?.name ?? "Subject"}</span>
                </div>
                <p className="font-grotesk font-bold text-on-surface truncate">{exam.title}</p>
                <span data-testid="exam-countdown-days" className={`self-start text-xs font-bold px-2 py-1 rounded-full font-jetbrains ${URGENCY_CLASSES[urgency(days)]}`}>
                  {countdownLabel(days)}
                </span>
                {prog.total > 0 && (
                  <div className="text-[11px] text-on-surface-variant">
                    Revision {prog.done}/{prog.total}
                    <div className="h-1.5 mt-1 rounded-full bg-[#1a1a24] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${prog.pct}%`, background: c.bar }} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
