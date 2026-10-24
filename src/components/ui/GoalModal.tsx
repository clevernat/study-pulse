"use client";

import { useState, useRef } from "react";
import { addGoal, updateGoal } from "@/lib/firebase/firestore";
import type { Goal, Subject } from "@/types";
import { localDateStr } from "@/lib/dateUtils";

export const typeColor: Record<Goal["type"], string> = {
  daily:     "#d2bbff",
  weekly:    "#40efb7",
  monthly:   "#ffb95f",
  quarterly: "#60a5fa",
  yearly:    "#f472b6",
};

export function deadlineForType(type: Goal["type"]): string {
  const d = new Date();
  if (type === "daily")     d.setDate(d.getDate());
  else if (type === "weekly")    d.setDate(d.getDate() + 7);
  else if (type === "monthly")   d.setDate(d.getDate() + 30);
  else if (type === "quarterly") d.setDate(d.getDate() + 90);
  else                           d.setDate(d.getDate() + 365);
  return localDateStr(d);
}

interface GoalModalProps {
  uid: string;
  subjects: Subject[];
  editGoal?: Goal;
  /** Pre-select and lock a subject (used when creating a goal from the Subjects page) */
  initialSubjectId?: string;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onUpdate: (goal: Goal) => void;
}

export default function GoalModal({
  uid,
  subjects,
  editGoal,
  initialSubjectId,
  onClose,
  onSave,
  onUpdate,
}: GoalModalProps) {
  const isEdit = !!editGoal;
  const locked = !!initialSubjectId && !isEdit;

  const [title, setTitle] = useState(editGoal?.title ?? "");
  const [type, setType] = useState<Goal["type"]>(editGoal?.type ?? "weekly");
  const [targetHours, setTargetHours] = useState(String(editGoal?.targetHours ?? "2"));
  const [deadline, setDeadline] = useState(editGoal?.deadline ?? deadlineForType("weekly"));
  const [subjectId, setSubjectId] = useState(editGoal?.subjectId ?? initialSubjectId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const userEditedDeadline = useRef(false);
  const handleTypeChange = (newType: Goal["type"]) => {
    setType(newType);
    if (!userEditedDeadline.current) setDeadline(deadlineForType(newType));
  };
  const handleDeadlineChange = (val: string) => {
    userEditedDeadline.current = true;
    setDeadline(val);
  };

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const lockedSubject   = subjects.find((s) => s.id === initialSubjectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Goal title is required."); return; }
    if (!subjectId)    { setError("Please select a subject for this goal."); return; }
    const hrs = parseFloat(targetHours);
    if (isNaN(hrs) || hrs <= 0) { setError("Target hours must be a positive number."); return; }
    if (hrs > 200)              { setError("Target hours cannot exceed 200."); return; }
    if (!deadline)              { setError("Please set a deadline."); return; }
    const today = localDateStr();
    if (!isEdit && deadline < today) { setError("Deadline cannot be in the past."); return; }

    setSaving(true);
    try {
      const sub = selectedSubject;
      const payload: Omit<Goal, "id"> = {
        uid,
        title: title.trim(),
        type,
        targetHours: hrs,
        currentHours: editGoal?.currentHours ?? 0,
        deadline,
        completed: editGoal?.completed ?? false,
        createdAt: editGoal?.createdAt ?? today,
        ...(sub
          ? { subjectId: sub.id, subjectName: sub.name }
          : { subjectId: undefined, subjectName: undefined }),
      };

      if (isEdit && editGoal) {
        await updateGoal(uid, editGoal.id, payload);
        onUpdate({ id: editGoal.id, ...payload });
      } else {
        const id = await addGoal(uid, payload);
        onSave({ id, ...payload });
      }
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const typeOptions: { value: Goal["type"]; label: string; color: string }[] = [
    { value: "daily",     label: "Daily",     color: typeColor.daily },
    { value: "weekly",    label: "Weekly",    color: typeColor.weekly },
    { value: "monthly",   label: "Monthly",   color: typeColor.monthly },
    { value: "quarterly", label: "Quarterly", color: typeColor.quarterly },
    { value: "yearly",    label: "Yearly",    color: typeColor.yearly },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#12121a] border border-[#252535] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-4 flex-shrink-0">
          <div>
            <h2 className="font-grotesk font-bold text-xl text-on-surface">
              {isEdit ? "Edit Goal" : "Set a Goal"}
            </h2>
            {locked && lockedSubject && (
              <p className="text-xs text-on-surface-variant mt-0.5">
                for <span className="text-primary font-semibold">{lockedSubject.name}</span>
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-8 pb-8 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Goal Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={locked && lockedSubject ? `e.g. Master ${lockedSubject.name}` : "e.g. Weekly Study Goal"}
              maxLength={60}
              className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className="py-2 rounded-xl border text-sm font-bold transition-all"
                  style={
                    type === t.value
                      ? { borderColor: t.color, color: t.color, background: `${t.color}18` }
                      : { borderColor: "#252535", color: "#8a7fa8" }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Hours */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Target hours</label>
            <input
              type="number"
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value)}
              min="0.5"
              max="200"
              step="0.5"
              className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Deadline</label>
            <div className="relative">
              <input
                ref={dateInputRef}
                type="date"
                value={deadline}
                onChange={(e) => handleDeadlineChange(e.target.value)}
                className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm pr-12"
                style={{ colorScheme: "dark" }}
              />
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker()}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                tabIndex={-1}
              >
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant/60 mt-1 font-inter">
              Auto-set for {type === "daily" ? "today" : type === "weekly" ? "7 days" : type === "monthly" ? "30 days" : type === "quarterly" ? "90 days" : "365 days"} — or pick manually
            </p>
          </div>

          {/* Subject */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">
              Subject <span className="text-error">*</span>
              {!locked && <span className="text-on-surface-variant/50 font-normal ml-1">— progress auto-tracks from your sessions</span>}
            </label>
            {locked && lockedSubject ? (
              // Locked to the subject the user came from — show read-only pill
              <div className="flex items-center gap-3 bg-[#0e0e11] border border-primary/30 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-primary text-[18px]">{lockedSubject.icon}</span>
                <span className="text-on-surface font-medium text-sm">{lockedSubject.name}</span>
                <span className="ml-auto text-xs text-on-surface-variant">{lockedSubject.category}</span>
              </div>
            ) : subjects.length === 0 ? (
              <p className="text-xs text-error bg-error/10 border border-error/20 rounded-xl px-4 py-3 font-inter">
                No subjects yet — add a subject first.
              </p>
            ) : (
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm"
                style={{ colorScheme: "dark" }}
              >
                <option value="">— Select a subject —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="text-error text-sm font-inter bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all font-inter text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <span className="w-4 h-4 rounded-full border-2 border-on-primary-container border-t-transparent animate-spin" />}
              {isEdit ? "Save Changes" : locked ? "Set Goal & Study" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
