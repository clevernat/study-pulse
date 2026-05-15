"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeGoals, addGoal, updateGoal, deleteGoal, subscribeSubjects } from "@/lib/firebase/firestore";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Goal, Subject } from "@/types";

const typeColor: Record<Goal["type"], string> = {
  daily: "#d2bbff",
  weekly: "#40efb7",
  monthly: "#ffb95f",
};

function ProgressRing({ current, target, color }: { current: number; target: number; color: string }) {
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(current / target, 1);
  const offset = circumference * (1 - progress);
  const pct = Math.round(progress * 100);
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="80" height="80" className="timer-ring">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#252535" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <span className="absolute font-jetbrains text-[13px] font-bold text-on-surface">{pct}%</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deadlineForType(type: Goal["type"]): string {
  const d = new Date();
  if (type === "daily") d.setDate(d.getDate());
  else if (type === "weekly") d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// ── Goal Modal (create + edit) ────────────────────────────────────────────────

interface GoalModalProps {
  uid: string;
  subjects: Subject[];
  editGoal?: Goal;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onUpdate: (goal: Goal) => void;
}

function GoalModal({ uid, subjects, editGoal, onClose, onSave, onUpdate }: GoalModalProps) {
  const isEdit = !!editGoal;

  const [title, setTitle] = useState(editGoal?.title ?? "");
  const [type, setType] = useState<Goal["type"]>(editGoal?.type ?? "weekly");
  const [targetHours, setTargetHours] = useState(String(editGoal?.targetHours ?? "2"));
  const [deadline, setDeadline] = useState(editGoal?.deadline ?? deadlineForType("weekly"));
  const [subjectId, setSubjectId] = useState(editGoal?.subjectId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Auto-update deadline when type changes (only in create mode, or if user hasn't customised)
  const userEditedDeadline = useRef(false);
  const handleTypeChange = (newType: Goal["type"]) => {
    setType(newType);
    if (!userEditedDeadline.current) {
      setDeadline(deadlineForType(newType));
    }
  };

  const handleDeadlineChange = (val: string) => {
    userEditedDeadline.current = true;
    setDeadline(val);
  };

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Goal title is required."); return; }
    const hrs = parseFloat(targetHours);
    if (isNaN(hrs) || hrs <= 0) { setError("Target hours must be a positive number."); return; }
    setSaving(true);
    try {
      const payload: Omit<Goal, "id"> = {
        uid,
        title: title.trim(),
        type,
        targetHours: hrs,
        currentHours: editGoal?.currentHours ?? 0,
        deadline,
        completed: editGoal?.completed ?? false,
        createdAt: editGoal?.createdAt ?? new Date().toISOString().slice(0, 10),
        ...(selectedSubject
          ? { subjectId: selectedSubject.id, subjectName: selectedSubject.name }
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
    { value: "daily", label: "Daily", color: "#d2bbff" },
    { value: "weekly", label: "Weekly", color: "#40efb7" },
    { value: "monthly", label: "Monthly", color: "#ffb95f" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#12121a] border border-[#252535] rounded-2xl p-8 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-grotesk font-bold text-xl text-on-surface">
            {isEdit ? "Edit Goal" : "New Goal"}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Goal Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Daily Study Goal"
              maxLength={60}
              className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Type</label>
            <div className="flex gap-3">
              {typeOptions.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all`}
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
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Target Hours</label>
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
              Auto-set for {type === "daily" ? "today" : type === "weekly" ? "7 days" : "30 days"} — or pick manually
            </p>
          </div>

          {/* Optional Subject */}
          {subjects.length > 0 && (
            <div>
              <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Subject (optional)</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm"
                style={{ colorScheme: "dark" }}
              >
                <option value="">— No specific subject —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

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
              {isEdit ? "Save Changes" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterType = "All" | "daily" | "weekly" | "monthly";

export default function GoalsPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const goalToDelete = goals.find((g) => g.id === confirmDeleteId);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeGoals(user.uid, setGoals);
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const openCreate = () => { setEditingGoal(undefined); setShowModal(true); };
  const openEdit = (goal: Goal) => { setEditingGoal(goal); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingGoal(undefined); };

  const handleSave = (goal: Goal) => setGoals((prev) => [...prev, goal]);
  const handleUpdate = (updated: Goal) =>
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));

  const handleDelete = async () => {
    if (!user || !confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      await deleteGoal(user.uid, confirmDeleteId);
      setGoals((prev) => prev.filter((g) => g.id !== confirmDeleteId));
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = goals.filter((g) => !g.completed).length;
  const completedCount = goals.filter((g) => g.completed).length;
  const completionRate = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

  const filteredGoals = activeFilter === "All" ? goals : goals.filter((g) => g.type === activeFilter);
  const filters: FilterType[] = ["All", "daily", "weekly", "monthly"];
  const filterLabels: Record<FilterType, string> = { All: "All", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

  const typeBadge = (t: Goal["type"]) =>
    t === "daily" ? "chip" : t === "weekly" ? "chip-secondary" : "chip-tertiary";

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-grotesk font-bold text-3xl text-on-surface">Study Goals</h1>
          <p className="text-on-surface-variant text-sm font-inter mt-1">
            {goals.length === 0 ? "No goals yet" : `${activeCount} active · ${completedCount} completed`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary-container text-on-primary-container px-5 py-2.5 rounded-full font-bold font-grotesk hover:opacity-80 transition-all text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Goal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <div className="glass-card p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[28px]">track_changes</span>
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-inter">Active Goals</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{activeCount}</span>
        </div>
        <div className="glass-card p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-[28px]">check_circle</span>
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-inter">Completed</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{completedCount}</span>
        </div>
        <div className="glass-card p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[28px]">pie_chart</span>
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-inter">Completion Rate</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{completionRate}%</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              activeFilter === f
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-[#252535]"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="glass-card p-16 flex flex-col items-center justify-center gap-4 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40">track_changes</span>
          <div>
            <p className="text-on-surface font-grotesk font-bold text-lg">No goals yet</p>
            <p className="text-on-surface-variant font-inter text-sm mt-1">
              Set a study goal to stay focused and track your progress.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="mt-2 bg-primary-container text-on-primary-container px-5 py-2 rounded-full font-bold font-grotesk text-sm hover:opacity-80 transition-all"
          >
            + Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredGoals.map((goal) => {
            const color = typeColor[goal.type];
            const pct = Math.min(Math.round((goal.currentHours / goal.targetHours) * 100), 100);
            const remaining = Math.max(goal.targetHours - goal.currentHours, 0);

            return (
              <div key={goal.id} className="glass-card p-6 flex flex-col gap-4">
                {/* Top Row */}
                <div className="flex items-center justify-between">
                  <span className={typeBadge(goal.type)}>
                    {goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}
                  </span>
                  <div className="flex items-center gap-1">
                    {goal.completed ? (
                      <span className="flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full bg-secondary/10 text-secondary mr-2">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Done
                      </span>
                    ) : (
                      <span className="text-sm text-on-surface-variant mr-2">Due {goal.deadline}</span>
                    )}
                    {/* Edit */}
                    <button
                      onClick={() => openEdit(goal)}
                      className="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10"
                      title="Edit goal"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => setConfirmDeleteId(goal.id)}
                      disabled={deletingId === goal.id}
                      className="text-on-surface-variant hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10"
                      title="Delete goal"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {deletingId === goal.id ? "hourglass_empty" : "delete_outline"}
                      </span>
                    </button>
                  </div>
                </div>

                <h3 className="font-grotesk text-[18px] font-bold text-on-surface">{goal.title}</h3>

                {goal.subjectName && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">menu_book</span>
                    <span className="text-sm text-on-surface-variant">{goal.subjectName}</span>
                  </div>
                )}

                <div className="flex items-center gap-6">
                  <ProgressRing current={goal.currentHours} target={goal.targetHours} color={color} />
                  <div className="flex flex-col gap-2 flex-1">
                    <span className="font-jetbrains text-xl font-bold text-on-surface">
                      {goal.currentHours}
                      <span className="text-on-surface-variant text-sm font-normal"> / {goal.targetHours}h</span>
                    </span>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    {goal.completed ? (
                      <span className="text-sm font-bold text-secondary">Goal Achieved!</span>
                    ) : (
                      <span className="text-sm text-on-surface-variant">{remaining.toFixed(1)}h remaining</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && user && (
        <GoalModal
          uid={user.uid}
          subjects={subjects}
          editGoal={editingGoal}
          onClose={closeModal}
          onSave={handleSave}
          onUpdate={handleUpdate}
        />
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete Goal"
        description={`Delete "${goalToDelete?.title ?? "this goal"}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        icon="flag"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
