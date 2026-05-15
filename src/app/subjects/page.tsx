"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { subscribeSubjects, addSubject, updateSubject, deleteSubject } from "@/lib/firebase/firestore";
import { useTimerStore } from "@/store/timerStore";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { COLOR_PALETTE, getColor } from "@/lib/colorPalette";
import type { Subject } from "@/types";

const ICON_OPTIONS = [
  { value: "school",           label: "School" },
  { value: "code",             label: "Code" },
  { value: "functions",        label: "Math" },
  { value: "language",         label: "Language" },
  { value: "history_edu",      label: "History" },
  { value: "science",          label: "Science" },
  { value: "biotech",          label: "Biology" },
  { value: "psychology",       label: "Psychology" },
  { value: "calculate",        label: "Statistics" },
  { value: "menu_book",        label: "Literature" },
  { value: "computer",         label: "Computer" },
  { value: "thermostat",       label: "Physics" },
  { value: "grid_on",          label: "Algebra" },
  { value: "bar_chart",        label: "Economics" },
  { value: "public",           label: "Geography" },
  { value: "brush",            label: "Art" },
  { value: "music_note",       label: "Music" },
  { value: "sports_soccer",    label: "Sports" },
  { value: "favorite",         label: "Health" },
  { value: "eco",              label: "Environment" },
  { value: "business_center",  label: "Business" },
  { value: "gavel",            label: "Law" },
  { value: "architecture",     label: "Design" },
  { value: "engineering",      label: "Engineering" },
  { value: "medical_services", label: "Medicine" },
  { value: "palette",          label: "Creative" },
  { value: "movie",            label: "Film" },
  { value: "translate",        label: "Linguistics" },
  { value: "analytics",        label: "Analytics" },
  { value: "hub",              label: "Networking" },
  { value: "robot",            label: "AI / ML" },
  { value: "finance",          label: "Finance" },
  { value: "flight",           label: "Aerospace" },
  { value: "agriculture",      label: "Agriculture" },
  { value: "sports_esports",   label: "Gaming" },
];

const CATEGORY_OPTIONS = ["STEM", "CS", "MATH", "LANG", "HUMN", "SCI", "ART", "BIZ", "MED", "LAW", "ENG", "MUS", "SPORT", "OTHER"];

// ── Subject Modal (Add + Edit) ────────────────────────────────────────────────

interface SubjectModalProps {
  onClose: () => void;
  onSave: (subject: Subject) => void;
  uid: string;
  /** Pass an existing subject to open in edit mode */
  editing?: Subject;
}

function SubjectModal({ onClose, onSave, uid, editing }: SubjectModalProps) {
  const isEdit = !!editing;

  // Initialise from existing subject when editing, otherwise blank defaults
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? "violet");
  const [icon, setIcon] = useState(editing?.icon ?? "school");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState(false);

  // Category: if the saved category matches a known option use it, else "OTHER"
  const knownCats = CATEGORY_OPTIONS.filter((c) => c !== "OTHER");
  const initialCat = editing
    ? (knownCats.includes(editing.category) ? editing.category : "OTHER")
    : "STEM";
  const [category, setCategory] = useState(initialCat);
  const [customCategory, setCustomCategory] = useState(
    editing && !knownCats.includes(editing.category) ? editing.category : ""
  );

  const effectiveCategory = category === "OTHER"
    ? (customCategory.trim().toUpperCase() || "OTHER")
    : category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Subject name is required."); setNameError(true); return; }
    setNameError(false);
    if (category === "OTHER" && !customCategory.trim()) { setError("Please enter a custom category."); return; }
    setSaving(true);
    try {
      if (isEdit && editing) {
        // ── Edit mode: update changed fields only ──
        await updateSubject(uid, editing.id, {
          name: name.trim(),
          icon,
          color,
          category: effectiveCategory,
        });
        onSave({ ...editing, name: name.trim(), icon, color, category: effectiveCategory });
      } else {
        // ── Add mode: create new subject ──
        const newSubject: Omit<Subject, "id"> = {
          uid,
          name: name.trim(),
          icon,
          color,
          category: effectiveCategory,
          totalMinutes: 0,
          sessionCount: 0,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        const id = await addSubject(uid, newSubject);
        onSave({ id, ...newSubject });
      }
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const palette = getColor(color);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#12121a] border border-[#252535] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {isEdit && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: palette.bg }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: palette.text }}>{icon}</span>
              </div>
            )}
            <h2 className="font-grotesk font-bold text-xl text-on-surface">
              {isEdit ? `Edit "${editing!.name}"` : "Add Subject"}
            </h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-7 pb-7 overflow-y-auto">
          {/* Name */}
          <div>
            <label className={`text-sm font-inter mb-1.5 block ${nameError ? "text-error" : "text-on-surface-variant"}`}>
              Subject Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
              placeholder="e.g. Calculus II"
              maxLength={40}
              className={`bg-[#0e0e11] border rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none transition-colors font-inter text-sm placeholder:text-on-surface-variant/40 ${
                nameError ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
              }`}
              autoFocus
            />
            {nameError && <p className="text-error text-xs font-inter mt-1">Subject name is required.</p>}
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
            {category === "OTHER" && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Type your category name…"
                maxLength={20}
                className="mt-3 bg-[#0e0e11] border border-primary/40 rounded-xl px-4 py-2.5 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40"
              />
            )}
          </div>

          {/* Color */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-2 block">Color</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(COLOR_PALETTE).map(([key, c]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  style={color === key ? { borderColor: c.dot, background: c.bg } : {}}
                  className={`flex items-center gap-2 px-2 py-2 rounded-xl border text-xs font-inter transition-all justify-center ${
                    color === key ? "" : "border-outline-variant text-on-surface-variant hover:border-outline"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                  <span style={color === key ? { color: c.text } : {}} className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-2 block">Icon</label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic.value}
                  type="button"
                  title={ic.label}
                  onClick={() => setIcon(ic.value)}
                  style={icon === ic.value ? { borderColor: palette.dot, background: palette.bg } : {}}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    icon === ic.value ? "" : "border-outline-variant hover:border-outline"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ color: palette.text }}>
                    {ic.value}
                  </span>
                  <span className="text-[8px] text-on-surface-variant truncate w-full text-center">{ic.label}</span>
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
              className="flex-1 py-3 rounded-xl font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: palette.bar, color: "#fff" }}
            >
              {saving && <span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />}
              {isEdit ? "Save Changes" : "Add Subject"}
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
  const router = useRouter();
  const setSubject = useTimerStore((s) => s.setSubject);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const subjectToDelete = subjects.find((s) => s.id === confirmDeleteId);

  function studyNow(subject: Subject) {
    setSubject(subject.id, subject.name);
    router.push(`/timer?subjectId=${encodeURIComponent(subject.id)}&subjectName=${encodeURIComponent(subject.name)}`);
  }

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSubjects(user.uid, setSubjects);
    return () => unsub();
  }, [user]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSave = (_subject: Subject) => {
    // No manual update needed — subscribeSubjects real-time listener
    // will fire automatically and update subjects state from Firestore.
    // Doing it manually here too causes the duplicate card bug.
  };

  const handleDelete = async () => {
    if (!user || !confirmDeleteId) return;
    const idToDelete = confirmDeleteId;
    setDeletingId(idToDelete);
    setConfirmDeleteId(null);
    try {
      await deleteSubject(user.uid, idToDelete);
      // Subscription will remove it automatically; no manual state update needed
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
            const c = getColor(subject.color);
            const hours = (subject.totalMinutes / 60).toFixed(1);
            const pct = Math.round((subject.totalMinutes / maxMinutes) * 100);

            return (
              <div key={subject.id} className="glass-card-hover p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                    <span className="material-symbols-outlined text-xl" style={{ color: c.text }}>{subject.icon}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingSubject(subject)}
                      className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-lg hover:bg-primary/10"
                      title="Edit subject"
                    >
                      <span className="material-symbols-outlined text-xl">edit</span>
                    </button>
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
                </div>

                <h2 className="font-grotesk font-bold text-[18px] text-on-surface leading-tight">{subject.name}</h2>

                <span
                  className="self-start px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: c.chip, color: c.chipText }}
                >
                  {subject.category}
                </span>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="font-jetbrains font-semibold text-[20px]" style={{ color: c.text }}>{hours}h</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">Total Hours</div>
                  </div>
                  <div className="text-right">
                    <div className="font-jetbrains font-semibold text-[20px] text-on-surface">{subject.sessionCount}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">Sessions</div>
                  </div>
                </div>

                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: c.bar }} />
                </div>

                <button
                  onClick={() => studyNow(subject)}
                  className="text-sm font-semibold font-inter hover:opacity-80 transition-opacity mt-1 text-left"
                  style={{ color: c.text }}
                >
                  Study Now →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showModal && user && (
        <SubjectModal uid={user.uid} onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
      {editingSubject && user && (
        <SubjectModal
          uid={user.uid}
          editing={editingSubject}
          onClose={() => setEditingSubject(null)}
          onSave={handleSave}
        />
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
