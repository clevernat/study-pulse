"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Field, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import { addItem, updateItem, deleteItem } from "@/lib/firebase/firestore";
import { COLOR_PALETTE } from "@/lib/colorPalette";
import type { Habit } from "@/types";

const ICONS = ["menu_book", "style", "timer", "fitness_center", "self_improvement", "water_drop", "bedtime", "edit_note", "language", "psychology"];

export default function HabitModal({ uid, habit, onClose }: { uid: string; habit?: Habit; onClose: () => void }) {
  const [title, setTitle] = useState(habit?.title ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? ICONS[0]);
  const [color, setColor] = useState(habit?.color ?? "violet");
  const [weekly, setWeekly] = useState(habit?.schedule.type === "weekly");
  const [times, setTimes] = useState(habit?.schedule.type === "weekly" ? habit.schedule.timesPerWeek : 3);
  const [target, setTarget] = useState(habit?.target ?? 1);
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [auto, setAuto] = useState<Habit["autoSource"] | "">(habit?.autoSource ?? "");
  const [reminder, setReminder] = useState(habit?.reminderTime ?? "");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the habit a name.");
    if (!(target >= 1 && target <= 10000)) return setError("The daily amount must be 1 or more.");
    const data = {
      title: title.trim().slice(0, 80), icon, color,
      schedule: weekly ? { type: "weekly" as const, timesPerWeek: Math.min(7, Math.max(1, times)) } : { type: "daily" as const },
      target, unit: auto === "studyMinutes" ? "min" : auto === "cardsReviewed" ? "cards" : unit.trim() || undefined,
      autoSource: auto || undefined,
      reminderTime: reminder || undefined,
    };
    if (habit) await updateItem<Habit>(uid, "habits", habit.id, data);
    else await addItem<Habit>(uid, "habits", { ...data, log: {}, createdAt: Date.now() });
    onClose();
  }

  async function remove() {
    if (!habit || !confirm(`Delete "${habit.title}" and all its history? (Archive keeps the history.)`)) return;
    await deleteItem(uid, "habits", habit.id);
    onClose();
  }

  return (
    <Modal title={habit ? "Edit habit" : "New habit"} onClose={onClose} testId="habit-modal">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Name"><input data-testid="habit-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review flashcards" maxLength={80} /></Field>
        <div className="flex flex-wrap gap-2" aria-label="Icon">
          {ICONS.map((i) => (
            <button key={i} type="button" aria-label={i} onClick={() => setIcon(i)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center border ${icon === i ? "border-primary bg-primary/15 text-primary" : "border-outline-variant text-on-surface-variant"}`}>
              <span className="material-symbols-outlined text-[18px]">{i}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Colour">
          {Object.entries(COLOR_PALETTE).slice(0, 10).map(([k, c]) => (
            <button key={k} type="button" aria-label={c.label} onClick={() => setColor(k)} className={`w-6 h-6 rounded-full ${color === k ? "ring-2 ring-offset-2 ring-offset-card ring-white" : ""}`} style={{ background: c.dot }} />
          ))}
        </div>
        <Field label="How often">
          <select data-testid="habit-schedule" className={inputCls} value={weekly ? "weekly" : "daily"} onChange={(e) => setWeekly(e.target.value === "weekly")}>
            <option value="daily">Every day</option>
            <option value="weekly">Some days each week</option>
          </select>
        </Field>
        {weekly && (
          <Field label="Days per week"><input type="number" min={1} max={7} className={inputCls} value={times} onChange={(e) => setTimes(Number(e.target.value))} /></Field>
        )}
        <Field label="Check it">
          <select data-testid="habit-auto" className={inputCls} value={auto} onChange={(e) => setAuto(e.target.value as Habit["autoSource"] | "")}>
            <option value="">By hand</option>
            <option value="studyMinutes">Automatically: minutes studied</option>
            <option value="cardsReviewed">Automatically: flashcards reviewed</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={auto ? "Goal per day" : "Amount per day"}><input data-testid="habit-target" type="number" min={1} className={inputCls} value={target} onChange={(e) => setTarget(Number(e.target.value))} /></Field>
          {!auto && <Field label="Unit (optional)"><input className={inputCls} value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} placeholder="pages, glasses…" /></Field>}
          <Field label="Reminder"><input type="time" className={inputCls} style={{ colorScheme: "dark" }} value={reminder} onChange={(e) => setReminder(e.target.value)} /></Field>
        </div>
        {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 flex-wrap">
          {habit && <button type="button" onClick={remove} className={`${secondaryBtnCls} text-error`} aria-label="Delete habit"><span className="material-symbols-outlined text-[18px]">delete</span></button>}
          {habit && (
            <button type="button" onClick={async () => { await updateItem<Habit>(uid, "habits", habit.id, { archived: !habit.archived }); onClose(); }} className={secondaryBtnCls}>
              {habit.archived ? "Restore" : "Archive"}
            </button>
          )}
          <button type="button" onClick={onClose} className={`${secondaryBtnCls} flex-1`}>Cancel</button>
          <button type="submit" data-testid="habit-save" className={`${primaryBtnCls} flex-1`}>{habit ? "Save" : "Add habit"}</button>
        </div>
      </form>
    </Modal>
  );
}
