"use client";
import { daysUntil, countdownLabel, urgency, URGENCY_CLASSES, type Progress } from "@/lib/exams";
import { getColor } from "@/lib/colorPalette";
import type { Exam, Subject } from "@/types";

export function formatDay(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function ExamCard({ exam, subject, today, progress, onEdit, warning }: {
  exam: Exam; subject?: Subject; today: string; progress: Progress; onEdit: () => void; warning?: string;
}) {
  const days = daysUntil(exam.date, today);
  const c = getColor(subject?.color ?? "violet");
  const place = [exam.room && `Room ${exam.room}`, exam.seat && `Seat ${exam.seat}`].filter(Boolean).join(" · ");
  return (
    <div data-testid="exam-card" className="glass-card p-4 flex gap-4 items-start">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
        <span className="material-symbols-outlined" style={{ color: c.text }}>{subject?.icon ?? "event"}</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-grotesk font-bold text-on-surface">{exam.title}</p>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-jetbrains ${URGENCY_CLASSES[urgency(days)]}`}>{countdownLabel(days)}</span>
        </div>
        <p className="text-xs text-on-surface-variant">
          {subject?.name ?? "Subject"} · {formatDay(exam.date)}{exam.startTime ? ` · ${exam.startTime}` : ""}{exam.durationMinutes ? ` · ${exam.durationMinutes} min` : ""}
        </p>
        {place && <p className="text-xs text-on-surface-variant">{place}</p>}
        {warning && <p data-testid="exam-clash" className="text-xs text-tertiary flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">warning</span>{warning}</p>}
        {progress.total > 0 && (
          <div className="mt-1 text-[11px] text-on-surface-variant" data-testid="exam-progress">
            Revision {progress.done}/{progress.total} ({progress.pct}%)
            <div className="h-1.5 mt-1 rounded-full bg-[#1a1a24] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${progress.pct}%`, background: c.bar }} /></div>
          </div>
        )}
      </div>
      <button onClick={onEdit} aria-label={`Edit ${exam.title}`} data-testid="exam-edit" className="text-on-surface-variant hover:text-primary p-1">
        <span className="material-symbols-outlined text-[18px]">edit</span>
      </button>
    </div>
  );
}
