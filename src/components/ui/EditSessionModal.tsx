"use client";
import { useState } from "react";
import { useNewSubject } from "@/components/ui/NewSubject";
import { updateItem } from "@/lib/firebase/firestore";
import { useCollection } from "@/lib/firebase/useCollection";
import { toMinutes } from "@/lib/timetable";
import { minutesToHHMM } from "@/lib/calendar";
import TopicSelect from "@/components/ui/TopicSelect";
import { FOCUS_RATINGS } from "@/components/ui/ReflectionModal";
import { inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import type { Session, Subject, Topic } from "@/types";

/** Change any part of a saved session; the change is written to the database. */
export default function EditSessionModal({ uid, session, subjects, onClose }: { uid: string; session: Session; subjects: Subject[]; onClose: () => void }) {
  const { items: topics } = useCollection<Topic>("topics");
  const [subjectId, setSubjectId] = useState(session.subjectId);
  const newSubject = useNewSubject((id) => { setSubjectId(id); setTopicId(""); });
  const [topicId, setTopicId] = useState(session.topicId ?? "");
  const [date, setDate] = useState(session.date);
  const [start, setStart] = useState(session.startTime);
  const [minutes, setMinutes] = useState(String(session.durationMinutes));
  const [rating, setRating] = useState(session.focusRating ?? 0);
  const [distractions, setDistractions] = useState(String(session.distractions ?? 0));
  const [notes, setNotes] = useState(session.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const mins = parseInt(minutes), dist = parseInt(distractions || "0");
    if (isNaN(mins) || mins < 1 || mins > 24 * 60) return setError("Length must be between 1 and 1440 minutes.");
    if (isNaN(dist) || dist < 0) return setError("Distractions cannot be negative.");
    if (!date || !/^\d\d:\d\d$/.test(start)) return setError("Pick a date and start time.");
    const sub = subjects.find((s) => s.id === subjectId);
    const topic = topics.find((t) => t.id === topicId && t.subjectId === subjectId);
    setSaving(true);
    try {
      await updateItem<Session>(uid, "sessions", session.id, {
        subjectId,
        subjectName: sub?.name ?? session.subjectName,
        subjectColor: sub?.color ?? session.subjectColor,
        topicId: topic?.id,
        topicTitle: topic?.title,
        date,
        startTime: start,
        endTime: minutesToHHMM(Math.min(toMinutes(start) + mins, 24 * 60 - 1)),
        durationMinutes: mins,
        focusRating: rating || undefined,
        distractions: dist || undefined,
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} data-testid="edit-session" className="relative bg-card border border-outline-variant rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-grotesk font-bold text-xl text-on-surface">Edit session</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-on-surface-variant hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant font-bold">Subject</span>
          <select className={inputCls} value={subjectId} onChange={(e) => { if (newSubject.pick(e.target.value)) return; setSubjectId(e.target.value); setTopicId(""); }} data-testid="edit-session-subject">
            {!subjects.some((s) => s.id === subjectId) && <option value={subjectId}>{session.subjectName}</option>}
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {newSubject.option}
          </select>
        </label>
        {newSubject.form}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant font-bold">Topic</span>
          <TopicSelect subjectId={subjectId} topics={topics} value={topicId} onChange={(t) => setTopicId(t?.id ?? "")} testId="edit-session-topic" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-on-surface-variant font-bold">Date</span>
            <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: "dark" }} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-on-surface-variant font-bold">Start</span>
            <input className={inputCls} type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ colorScheme: "dark" }} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-on-surface-variant font-bold">Minutes</span>
            <input data-testid="edit-session-minutes" className={inputCls} type="number" min="1" max="1440" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="edit-focus-label" className="text-xs text-on-surface-variant font-bold">How focused were you?</span>
          <div role="radiogroup" aria-labelledby="edit-focus-label" className="grid grid-cols-5 gap-1.5">
            {FOCUS_RATINGS.map((r) => (
              <button key={r.value} type="button" role="radio" aria-checked={rating === r.value} aria-label={`${r.value}: ${r.label}`}
                data-testid={`edit-session-rating-${r.value}`}
                onClick={() => setRating(rating === r.value ? 0 : r.value)}
                className={`rounded-xl border py-1.5 font-jetbrains font-bold text-sm ${rating === r.value ? "bg-primary/20 border-primary text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/50"}`}>
                {r.value}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant font-bold">Distractions</span>
          <input data-testid="edit-session-distractions" className={`${inputCls} w-28`} type="number" min="0" value={distractions} onChange={(e) => setDistractions(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant font-bold">Notes</span>
          <textarea data-testid="edit-session-notes" className={`${inputCls} resize-none`} rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`${secondaryBtnCls} flex-1`}>Cancel</button>
          <button type="submit" data-testid="edit-session-save" disabled={saving} className={`${primaryBtnCls} flex-1`}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
