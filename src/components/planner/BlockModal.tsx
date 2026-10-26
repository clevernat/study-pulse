"use client";
import { useState } from "react";
import { useNewSubject } from "@/components/ui/NewSubject";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { Field, inputCls, primaryBtnCls, secondaryBtnCls, REMINDER_OPTIONS } from "@/components/ui/Field";
import { addItem, updateItem, deleteItem } from "@/lib/firebase/firestore";
import { validSlot } from "@/lib/timetable";
import { blockMinutes } from "@/lib/calendar";
import { useTimerStore } from "@/store/timerStore";
import type { Deck, StudyBlock, Subject, Task } from "@/types";
import { useCollection } from "@/lib/firebase/useCollection";

interface Props {
  uid: string;
  subjects: Subject[];
  tasks: Task[];
  block?: StudyBlock;
  /** For a new block: prefilled day and time */
  initial?: { date: string; start: string; end: string };
  onClose: () => void;
}

/** Starts the focus timer for a planned block: picks its subject and links the saved sessions. */
export function startBlockTimer(block: StudyBlock, subjects: Subject[]): boolean {
  const subject = subjects.find((s) => s.id === block.subjectId);
  if (!subject) return false;
  const ts = useTimerStore.getState();
  ts.setSubject(subject.id, subject.name);
  ts.setActiveBlock(block.id);
  return true;
}

export default function BlockModal({ uid, subjects, tasks, block, initial, onClose }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(block?.title ?? "");
  const [subjectId, setSubjectId] = useState(block?.subjectId ?? subjects[0]?.id ?? "");
  const newSubject = useNewSubject((id) => { setSubjectId(id); });
  const [taskId, setTaskId] = useState(block?.taskId ?? "");
  const [deckId, setDeckId] = useState(block?.deckId ?? "");
  const { items: decks } = useCollection<Deck>("decks");
  const subjectDecks = decks.filter((d) => !subjectId || d.subjectId === subjectId);
  const [date, setDate] = useState(block?.date ?? initial?.date ?? "");
  const [start, setStart] = useState(block?.start ?? initial?.start ?? "16:00");
  const [end, setEnd] = useState(block?.end ?? initial?.end ?? "17:00");
  const [reminder, setReminder] = useState(block?.reminderMinutesBefore?.toString() ?? "10");
  const [error, setError] = useState("");
  const openTasks = tasks.filter((t) => !t.completed && (!subjectId || !t.subjectId || t.subjectId === subjectId));

  function collect() {
    if (!date) { setError("Pick a day."); return null; }
    if (!validSlot(start, end)) { setError("The end time must be after the start time."); return null; }
    const task = tasks.find((t) => t.id === taskId);
    const subject = subjects.find((s) => s.id === subjectId);
    return {
      title: title.trim() || task?.title || (subject ? `Study ${subject.name}` : "Study"),
      subjectId: subjectId || undefined,
      taskId: taskId || undefined,
      deckId: deckId || undefined,
      date, start, end,
      reminderMinutesBefore: reminder === "" ? undefined : parseInt(reminder, 10),
    };
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const data = collect();
    if (!data) return null;
    if (block) { await updateItem<StudyBlock>(uid, "studyBlocks", block.id, data); onClose(); return { ...block, ...data }; }
    const id = await addItem<StudyBlock>(uid, "studyBlocks", { ...data, createdAt: Date.now() });
    onClose();
    return { id, ...data, createdAt: Date.now() } as StudyBlock;
  }

  async function startNow() {
    const saved = await save();
    if (!saved) return;
    // A flashcard block opens the review; its time is saved on the block.
    if (saved.deckId) return router.push(`/flashcards/review?deck=${saved.deckId}&block=${saved.id}`);
    if (!startBlockTimer(saved, subjects)) return setError("Pick a subject to start the timer.");
    router.push("/timer");
  }

  async function remove() {
    if (!block || !confirm("Delete this study block?")) return;
    await deleteItem(uid, "studyBlocks", block.id);
    onClose();
  }

  return (
    <Modal title={block ? "Study block" : "Plan study time"} onClose={onClose} testId="block-modal">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Subject">
          <select data-testid="block-subject" className={inputCls} value={subjectId} onChange={(e) => newSubject.pick(e.target.value) || setSubjectId(e.target.value)}>
            <option value="">No subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {newSubject.option}
          </select>
        </Field>
        {newSubject.form}
        <Field label="Title (optional)">
          <input data-testid="block-title" className={inputCls} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read chapter 4" />
        </Field>
        {openTasks.length > 0 && (
          <Field label="For a task (optional)">
            <select className={inputCls} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">None</option>
              {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
        )}
        {subjectDecks.length > 0 && (
          <Field label="Review a flashcard deck (optional)">
            <select data-testid="block-deck" className={inputCls} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              <option value="">No — use the focus timer</option>
              {subjectDecks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Day" className="col-span-3 sm:col-span-1"><input data-testid="block-date" type="date" className={inputCls} style={{ colorScheme: "dark" }} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="From"><input data-testid="block-start" type="time" className={inputCls} style={{ colorScheme: "dark" }} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="To"><input data-testid="block-end" type="time" className={inputCls} style={{ colorScheme: "dark" }} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <Field label="Reminder">
          <select className={inputCls} value={reminder} onChange={(e) => setReminder(e.target.value)}>
            {REMINDER_OPTIONS.filter((o) => o.value !== "1440").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        {block && (
          <div data-testid="block-progress" className="text-sm text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">timer</span>
            {block.minutesDone ?? 0} of {blockMinutes(block)} min studied
            <label className="ml-auto flex items-center gap-1 text-xs">
              <input type="checkbox" checked={!!block.done} onChange={(e) => updateItem<StudyBlock>(uid, "studyBlocks", block.id, { done: e.target.checked })} />
              Done
            </label>
          </div>
        )}
        {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 flex-wrap">
          {block && <button type="button" onClick={remove} className={`${secondaryBtnCls} text-error`} aria-label="Delete block"><span className="material-symbols-outlined text-[18px]">delete</span></button>}
          <button type="submit" data-testid="block-save" className={`${secondaryBtnCls} flex-1`}>Save</button>
          <button type="button" data-testid="block-start-timer" onClick={startNow} className={`${primaryBtnCls} flex-1`}>
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>Start timer
          </button>
        </div>
      </form>
    </Modal>
  );
}
