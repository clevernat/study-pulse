"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { subscribeSubjects, addSubject, deleteSubject } from "@/lib/firebase/firestore";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { Subject } from "@/types";

type ColorKey = Subject["color"];

const colorMap: Record<ColorKey, { iconBg: string; iconText: string; chipClass: string; barFill: string }> = {
  primary: { iconBg: "bg-primary-container/20", iconText: "text-primary", chipClass: "chip", barFill: "bg-primary" },
  secondary: { iconBg: "bg-secondary-container/20", iconText: "text-secondary", chipClass: "chip-secondary", barFill: "bg-secondary" },
  tertiary: { iconBg: "bg-tertiary-container/20", iconText: "text-tertiary", chipClass: "chip-tertiary", barFill: "bg-tertiary" },
};

const ICON_OPTIONS = [
  { value: "school", label: "School" },
  { value: "code", label: "Code" },
  { value: "functions", label: "Math" },
  { value: "language", label: "Language" },
  { value: "history_edu", label: "History" },
  { value: "science", label: "Science" },
  { value: "biotech", label: "Biology" },
  { value: "psychology", label: "Psychology" },
  { value: "calculate", label: "Statistics" },
  { value: "menu_book", label: "Literature" },
  { value: "computer", label: "Computer" },
  { value: "thermostat", label: "Physics" },
  { value: "grid_on", label: "Algebra" },
  { value: "bar_chart", label: "Economics" },
  { value: "public", label: "Geography" },
];

const CATEGORY_OPTIONS = ["STEM", "CS", "MATH", "LANG", "HUMN", "SCI", "ART", "BIZ", "MED", "OTHER"];

const COLOR_OPTIONS: { value: ColorKey; label: string; dot: string }[] = [
  { value: "primary", label: "Violet", dot: "bg-primary" },
  { value: "secondary", label: "Emerald", dot: "bg-secondary" },
  { value: "tertiary", label: "Amber", dot: "bg-tertiary" },
];

// ── Add Subject Modal ─────────────────────────────────────────────────────────

interface AddSubjectModalProps {
  onClose: () => void;
  onSave: (subject: Subject) => void;
  uid: string;
}

function AddSubjectModal({ onClose, onSave, uid }: AddSubjectModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("STEM");
  const [color, setColor] = useState<ColorKey>("primary");
  const [icon, setIcon] = useState("school");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Subject name is required."); return; }
    setSaving(true);
    try {
      const newSubject: Omit<Subject, "id"> = {
        uid,
        name: name.trim(),
        icon,
        color,
        category,
        totalMinutes: 0,
        sessionCount: 0,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const id = await addSubject(uid, newSubject);
      onSave({ id, ...newSubject });
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#12121a] border border-[#252535] rounded-2xl p-8 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-grotesk font-bold text-xl text-on-surface">Add Subject</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Subject Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Calculus II"
              maxLength={40}
              className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    category === cat
                      ? "bg-primary-container text-on-primary-container"
                      : "border border-outline-variant text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Color</label>
            <div className="flex gap-3">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-inter ${
                    color === c.value
                      ? "border-primary bg-primary/10 text-on-surface"
                      : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${c.dot}`} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Icon</label>
            <div className="grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic.value}
                  type="button"
                  title={ic.label}
                  onClick={() => setIcon(ic.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    icon === ic.value
                      ? "border-primary bg-primary/10"
                      : "border-outline-variant hover:border-primary/40"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${colorMap[color].iconText}`}>
                    {ic.value}
                  </span>
                  <span className="text-[9px] text-on-surface-variant truncate w-full text-center">{ic.label}</span>
                </button>
              ))}
            </div>
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
              Add Subject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const subjectToDelete = subjects.find((s) => s.id === confirmDeleteId);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSubjects(user.uid, setSubjects);
    return () => unsub();
  }, [user]);

  const handleSave = (subject: Subject) => {
    setSubjects((prev) => [...prev, subject]);
  };

  const handleDelete = async () => {
    if (!user || !confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      await deleteSubject(user.uid, confirmDeleteId);
      setSubjects((prev) => prev.filter((s) => s.id !== confirmDeleteId));
    } finally {
      setDeletingId(null);
    }
  };

  const maxMinutes = Math.max(...subjects.map((s) => s.totalMinutes), 1);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-grotesk font-bold text-3xl text-on-surface">Subjects</h1>
          <p className="text-on-surface-variant text-sm font-inter mt-1">
            {subjects.length === 0 ? "No subjects yet" : `${subjects.length} subject${subjects.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary-container text-on-primary-container px-5 py-2.5 rounded-full font-bold font-grotesk hover:opacity-80 transition-all text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Subject
        </button>
      </div>

      {/* Grid */}
      {subjects.length === 0 ? (
        <div className="glass-card p-16 flex flex-col items-center justify-center gap-4 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40">school</span>
          <div>
            <p className="text-on-surface font-grotesk font-bold text-lg">No subjects yet</p>
            <p className="text-on-surface-variant font-inter text-sm mt-1">Add your first subject to start tracking study time.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 bg-primary-container text-on-primary-container px-5 py-2 rounded-full font-bold font-grotesk text-sm hover:opacity-80 transition-all"
          >
            + Add Your First Subject
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {subjects.map((subject) => {
            const meta = colorMap[subject.color];
            const hours = (subject.totalMinutes / 60).toFixed(1);
            const pct = Math.round((subject.totalMinutes / maxMinutes) * 100);

            return (
              <div key={subject.id} className="glass-card-hover p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.iconBg}`}>
                    <span className={`material-symbols-outlined text-xl ${meta.iconText}`}>{subject.icon}</span>
                  </div>
                  <button
                    onClick={() => setConfirmDeleteId(subject.id)}
                    disabled={deletingId === subject.id}
                    className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-lg hover:bg-error/10"
                    title="Delete subject"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {deletingId === subject.id ? "hourglass_empty" : "delete_outline"}
                    </span>
                  </button>
                </div>

                <div>
                  <h2 className="font-grotesk font-bold text-[18px] text-on-surface leading-tight">{subject.name}</h2>
                </div>

                <div>
                  <span className={meta.chipClass}>{subject.category}</span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <div className={`font-jetbrains font-semibold text-[20px] ${meta.iconText}`}>{hours}h</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">Total Hours</div>
                  </div>
                  <div className="text-right">
                    <div className="font-jetbrains font-semibold text-[20px] text-on-surface">{subject.sessionCount}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">Sessions</div>
                  </div>
                </div>

                <div className="progress-track">
                  <div className={`progress-fill ${meta.barFill}`} style={{ width: `${pct}%` }} />
                </div>

                <Link href="/timer" className={`text-sm font-semibold font-inter ${meta.iconText} hover:opacity-80 transition-opacity mt-1`}>
                  Study Now →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {showModal && user && (
        <AddSubjectModal uid={user.uid} onClose={() => setShowModal(false)} onSave={handleSave} />
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete Subject"
        description={`Delete "${subjectToDelete?.name ?? "this subject"}"? All its study data will be removed.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        icon="delete_outline"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
