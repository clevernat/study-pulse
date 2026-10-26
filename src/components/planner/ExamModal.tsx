"use client";
import { useState } from "react";
import { useNewSubject } from "@/components/ui/NewSubject";
import Modal from "@/components/ui/Modal";
import { Field, inputCls, primaryBtnCls, secondaryBtnCls, REMINDER_OPTIONS } from "@/components/ui/Field";
import { addItem, updateItem, deleteItem } from "@/lib/firebase/firestore";
import { localDateStr } from "@/lib/dateUtils";
import type { Exam, Subject } from "@/types";

interface Props {
  uid: string;
  subjects: Subject[];
  exam?: Exam;
  defaultSubjectId?: string;
  onClose: () => void;
}

export default function ExamModal({ uid, subjects, exam, defaultSubjectId, onClose }: Props) {
  const [pickedSubjectId, setSubjectId] = useState(exam?.subjectId ?? defaultSubjectId ?? "");
  const newSubject = useNewSubject((id) => { setSubjectId(id); });
  // Subjects may load after the form opens: fall back to the first one (the select shows it).
  const subjectId = pickedSubjectId || subjects[0]?.id || "";
  const [title, setTitle] = useState(exam?.title ?? "");
  const [date, setDate] = useState(exam?.date ?? "");
  const [startTime, setStartTime] = useState(exam?.startTime ?? "");
  const [duration, setDuration] = useState(exam?.durationMinutes?.toString() ?? "");
  const [room, setRoom] = useState(exam?.room ?? "");
  const [seat, setSeat] = useState(exam?.seat ?? "");
  const [notes, setNotes] = useState(exam?.notes ?? "");
  const [reminder, setReminder] = useState(exam?.reminderMinutesBefore?.toString() ?? "1440");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) return setError("Add a subject first.");
    if (!title.trim()) return setError("Give the exam a name.");
    if (!date) return setError("Pick the exam date.");
    const mins = duration ? parseInt(duration, 10) : undefined;
    if (mins !== undefined && (isNaN(mins) || mins <= 0 || mins > 720)) return setError("Length must be 1–720 minutes.");
    setSaving(true);
    const data = {
      subjectId,
      title: title.trim(),
      date,
      startTime: startTime || undefined,
      durationMinutes: mins,
      room: room.trim() || undefined,
      seat: seat.trim() || undefined,
      notes: notes.trim() || undefined,
      reminderMinutesBefore: reminder === "" ? undefined : parseInt(reminder, 10),
    };
    try {
      if (exam) await updateItem<Exam>(uid, "exams", exam.id, data);
      else await addItem<Exam>(uid, "exams", { ...data, createdAt: Date.now() });
      onClose();
    } catch {
      setError("Could not save. Please try again.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!exam || !confirm(`Delete the exam "${exam.title}"?`)) return;
    await deleteItem(uid, "exams", exam.id);
    onClose();
  }

  return (
    <Modal title={exam ? "Edit exam" : "New exam"} onClose={onClose} testId="exam-modal">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Subject">
          <select data-testid="exam-subject" className={inputCls} value={subjectId} onChange={(e) => newSubject.pick(e.target.value) || setSubjectId(e.target.value)}>
            {subjects.length === 0 && <option value="">No subjects yet</option>}
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {newSubject.option}
          </select>
        </Field>
        {newSubject.form}
        <Field label="Exam name">
          <input data-testid="exam-title" className={inputCls} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm, Final, Unit 3 test" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input data-testid="exam-date" type="date" min={exam ? undefined : localDateStr()} className={inputCls} style={{ colorScheme: "dark" }} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Start time">
            <input data-testid="exam-time" type="time" className={inputCls} style={{ colorScheme: "dark" }} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Length (min)">
            <input type="number" min={1} max={720} className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 90" />
          </Field>
          <Field label="Reminder">
            <select className={inputCls} value={reminder} onChange={(e) => setReminder(e.target.value)}>
              {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Room">
            <input data-testid="exam-room" className={inputCls} value={room} maxLength={60} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Hall B" />
          </Field>
          <Field label="Seat">
            <input className={inputCls} value={seat} maxLength={20} onChange={(e) => setSeat(e.target.value)} placeholder="e.g. 42" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={`${inputCls} min-h-[70px]`} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="What to bring, chapters, ..." />
        </Field>
        {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          {exam && <button type="button" onClick={remove} className={`${secondaryBtnCls} text-error`} aria-label="Delete exam"><span className="material-symbols-outlined text-[18px]">delete</span></button>}
          <button type="button" onClick={onClose} className={`${secondaryBtnCls} flex-1`}>Cancel</button>
          <button data-testid="exam-save" type="submit" disabled={saving} className={`${primaryBtnCls} flex-1`}>{exam ? "Save" : "Add exam"}</button>
        </div>
      </form>
    </Modal>
  );
}
