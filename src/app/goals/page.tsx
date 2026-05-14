"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserGoals, addGoal, deleteGoal, getUserSubjects } from "@/lib/firebase/firestore";
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

// ── Add Goal Modal ────────────────────────────────────────────────────────────

interface AddGoalModalProps {
  uid: string;
  subjects: Subject[];
  onClose: () => void;
  onSave: (goal: Goal) => void;
}

function AddGoalModal({ uid, subjects, onClose, onSave }: AddGoalModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Goal["type"]>("daily");
  const [targetHours, setTargetHours] = useState("2");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [subjectId, setSubjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Goal title is required."); return; }
    const hrs = parseFloat(targetHours);
    if (isNaN(hrs) || hrs <= 0) { setError("Target hours must be a positive number."); return; }
    setSaving(true);
    try {
      const newGoal: Omit<Goal, "id"> = {
        uid,
        title: title.trim(),
        type,
        targetHours: hrs,
        currentHours: 0,
        deadline,
        completed: false,
        createdAt: new Date().toISOString().slice(0, 10),
        ...(selectedSubject && { subjectId: selectedSubject.id, subjectName: selectedSubject.name }),
      };
      const id = await addGoal(uid, newGoal);
      onSave({ id, ...newGoal });
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
          <h2 className="font-grotesk font-bold text-xl text-on-surface">New Goal</h2>
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
                  onClick={() => setType(t.value)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${
                    type === t.value
                      ? "border-primary bg-primary/10 text-on-surface"
                      : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                  }`}
                  style={type === t.value ? { borderColor: t.color, color: t.color, background: `${t.color}10` } : {}}
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
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm"
            />
          </div>

          {/* Optional Subject */}
          {subjects.length > 0 && (
            <div>
              <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Subject (optional)</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm"
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
              Create Goal
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserGoals(user.uid).then(setGoals);
    getUserSubjects(user.uid).then(setSubjects);
  }, [user]);

  const handleSave = (goal: Goal) => setGoals((prev) => [...prev, goal]);

  const handleDelete = async (goalId: string) => {
    if (!user) return;
    setDeletingId(goalId);
    try {
      await deleteGoal(user.uid, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
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

  const typeBadge = (type: Goal["type"]) =>
    type === "daily" ? "chip" : type === "weekly" ? "chip-secondary" : "chip-tertiary";

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
          onClick={() => setShowModal(true)}
          className="bg-primary-container text-on-primary-container px-5 py-2.5 rounded-full font-bold font-grotesk hover:opacity-80 transition-all text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Goal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
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
            <p className="text-on-surface-variant font-inter text-sm mt-1">Set a study goal to stay focused and track your progress.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
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
                <div className="flex items-center justify-between">
                  <span className={typeBadge(goal.type)}>
                    {goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}
                  </span>
                  <div className="flex items-center gap-3">
                    {goal.completed ? (
                      <span className="flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full bg-secondary/10 text-secondary">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Done
                      </span>
                    ) : (
                      <span className="text-sm text-on-surface-variant">Due {goal.deadline}</span>
                    )}
                    <button
                      onClick={() => handleDelete(goal.id)}
                      disabled={deletingId === goal.id}
                      className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-lg hover:bg-error/10"
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
        <AddGoalModal uid={user.uid} subjects={subjects} onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}
