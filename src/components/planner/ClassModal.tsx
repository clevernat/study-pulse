"use client";
import { useState } from "react";
import { useNewSubject } from "@/components/ui/NewSubject";
import Modal from "@/components/ui/Modal";
import { Field, inputCls, primaryBtnCls, secondaryBtnCls, REMINDER_OPTIONS } from "@/components/ui/Field";
import { addItem, updateItem, deleteItem } from "@/lib/firebase/firestore";
import { WEEKDAYS, WEEK_LETTERS, validSlot } from "@/lib/timetable";
import type { ClassItem, ClassSlot, Subject } from "@/types";

interface Props { uid: string; subjects: Subject[]; rotationWeeks: number; item?: ClassItem; onClose: () => void }

export default function ClassModal({ uid, subjects, rotationWeeks, item, onClose }: Props) {
  const [pickedSubjectId, setSubjectId] = useState(item?.subjectId ?? "");
  const newSubject = useNewSubject((id) => { setSubjectId(id); });
  // Subjects may load after the form opens: fall back to the first one (the select shows it).
  const subjectId = pickedSubjectId || subjects[0]?.id || "";
  const [title, setTitle] = useState(item?.title ?? "");
  const [room, setRoom] = useState(item?.room ?? "");
  const [teacher, setTeacher] = useState(item?.teacher ?? "");
  const [reminder, setReminder] = useState(item?.reminderMinutesBefore?.toString() ?? "10");
  const [slots, setSlots] = useState<ClassSlot[]>(item?.slots ?? [{ weekday: 1, start: "09:00", end: "10:00" }]);
  const [error, setError] = useState("");

  const setSlot = (i: number, patch: Partial<ClassSlot>) => setSlots((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) return setError("Add a subject first.");
    if (slots.length === 0) return setError("Add at least one time.");
    if (!slots.every((s) => validSlot(s.start, s.end))) return setError("Each end time must be after its start time.");
    const clean = slots.map((s) => ({ weekday: s.weekday, start: s.start, end: s.end, ...(rotationWeeks > 1 && s.week ? { week: s.week } : {}) }));
    const data = {
      subjectId, slots: clean,
      title: title.trim() || undefined, room: room.trim() || undefined, teacher: teacher.trim() || undefined,
      reminderMinutesBefore: reminder === "" ? undefined : parseInt(reminder, 10),
    };
    if (item) await updateItem<ClassItem>(uid, "classes", item.id, data);
    else await addItem<ClassItem>(uid, "classes", { ...data, createdAt: Date.now() });
    onClose();
  }

  async function remove() {
    if (!item || !confirm("Delete this class from your timetable?")) return;
    await deleteItem(uid, "classes", item.id);
    onClose();
  }

  return (
    <Modal title={item ? "Edit class" : "New class"} onClose={onClose} testId="class-modal">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Subject">
          <select data-testid="class-subject" className={inputCls} value={subjectId} onChange={(e) => newSubject.pick(e.target.value) || setSubjectId(e.target.value)}>
            {subjects.length === 0 && <option value="">No subjects yet</option>}
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {newSubject.option}
          </select>
        </Field>
        {newSubject.form}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type (optional)"><input className={inputCls} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture, Lab…" /></Field>
          <Field label="Room"><input data-testid="class-room" className={inputCls} value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. 204" /></Field>
          <Field label="Teacher"><input className={inputCls} value={teacher} maxLength={60} onChange={(e) => setTeacher(e.target.value)} /></Field>
          <Field label="Reminder">
            <select className={inputCls} value={reminder} onChange={(e) => setReminder(e.target.value)}>
              {REMINDER_OPTIONS.filter((o) => o.value !== "1440").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-on-surface-variant font-bold">Times</span>
          {slots.map((slot, i) => (
            <div key={i} data-testid="class-slot" className="flex flex-wrap items-center gap-2">
              <select aria-label="Day" data-testid="class-day" className={`${inputCls} !w-auto flex-1`} value={slot.weekday} onChange={(e) => setSlot(i, { weekday: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
              </select>
              <input aria-label="Start" data-testid="class-start" type="time" className={`${inputCls} !w-[110px]`} style={{ colorScheme: "dark" }} value={slot.start} onChange={(e) => setSlot(i, { start: e.target.value })} />
              <input aria-label="End" data-testid="class-end" type="time" className={`${inputCls} !w-[110px]`} style={{ colorScheme: "dark" }} value={slot.end} onChange={(e) => setSlot(i, { end: e.target.value })} />
              {rotationWeeks > 1 && (
                <select aria-label="Week" data-testid="class-week" className={`${inputCls} !w-auto`} value={slot.week ?? 0} onChange={(e) => setSlot(i, { week: Number(e.target.value) || undefined })}>
                  <option value={0}>Every week</option>
                  {Array.from({ length: rotationWeeks }, (_, w) => <option key={w} value={w + 1}>Week {WEEK_LETTERS[w]}</option>)}
                </select>
              )}
              <button type="button" aria-label="Remove time" onClick={() => setSlots((l) => l.filter((_, j) => j !== i))} className="text-on-surface-variant/50 hover:text-error p-1">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
          <button type="button" data-testid="class-add-slot" onClick={() => setSlots((l) => [...l, { ...(l[l.length - 1] ?? { weekday: 1, start: "09:00", end: "10:00" }) }])}
            className="self-start text-sm text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">add</span>Add another time
          </button>
        </div>

        {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          {item && <button type="button" onClick={remove} className={`${secondaryBtnCls} text-error`} aria-label="Delete class"><span className="material-symbols-outlined text-[18px]">delete</span></button>}
          <button type="button" onClick={onClose} className={`${secondaryBtnCls} flex-1`}>Cancel</button>
          <button type="submit" data-testid="class-save" className={`${primaryBtnCls} flex-1`}>{item ? "Save" : "Add class"}</button>
        </div>
      </form>
    </Modal>
  );
}
