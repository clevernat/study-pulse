"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeGoals,
  deleteGoal,
  updateGoal,
  subscribeSubjects,
  subscribeSessions,
} from "@/lib/firebase/firestore";
import ConfirmModal from "@/components/ui/ConfirmModal";
import GoalModal, { typeColor } from "@/components/ui/GoalModal";
import { formatHours } from "@/lib/dateUtils";
import { localDateStr } from "@/lib/dateUtils";
import { Goal, Subject, Session } from "@/types";
import { goalHours } from "@/lib/insights";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dateStr + "T00:00:00");
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  if (days > 14) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 mr-2">
        <span className="material-symbols-outlined text-[13px]">schedule</span>
        {days}d left
      </span>
    );
  }
  if (days > 6) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 mr-2">
        <span className="material-symbols-outlined text-[13px]">schedule</span>
        {days}d left
      </span>
    );
  }
  if (days > 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-error/10 text-error border border-error/20 mr-2 animate-pulse">
        <span className="material-symbols-outlined text-[13px]">alarm</span>
        {days}d left
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-error/10 text-error border border-error/20 mr-2">
      <span className="material-symbols-outlined text-[13px]">alarm</span>
      Due today
    </span>
  );
}

function ProgressRing({ current, target, color }: { current: number; target: number; color: string }) {
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const exceeded = current > target;
  const progress = Math.min(current / target, 1);
  const offset = circumference * (1 - progress);
  const pct = Math.round((current / target) * 100);
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="80" height="80" className="timer-ring">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#292b30" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={exceeded ? "#5ed8a9" : color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={exceeded ? 0 : offset}
          transform="rotate(-90 40 40)"
          style={{ filter: exceeded ? "drop-shadow(0 0 6px #5ed8a9)" : "none" }}
        />
      </svg>
      <span className="absolute font-jetbrains text-[12px] font-bold" style={{ color: exceeded ? "#5ed8a9" : "#eeeef0" }}>
        {exceeded ? `+${pct - 100}%` : `${pct}%`}
      </span>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = "All" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
type SortBy = "deadline" | "progress" | "created";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { user } = useAuth();
  const today = localDateStr();

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("deadline");

  const [goals, setGoals] = useState<Goal[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [expiredOpen, setExpiredOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  const goalToDelete = goals.find((g) => g.id === confirmDeleteId);

  // ── Subscriptions ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeGoals(user.uid, setGoals);
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    const unsub3 = subscribeSessions(user.uid, setSessions);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  // ── Live progress ──────────────────────────────────────────────────────────
  const hoursPerGoal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const goal of goals) map[goal.id] = goalHours(goal, sessions); // exact; formatHours() rounds for display
    return map;
  }, [goals, sessions]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => { setEditingGoal(undefined); setShowModal(true); };
  const openEdit = (goal: Goal) => { setEditingGoal(goal); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingGoal(undefined); };
  // The live subscription adds the new goal; adding it here too showed it twice.
  const handleSave = () => {};
  const handleUpdate = (updated: Goal) =>
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));

  const handleDelete = async () => {
    if (!user || !confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      await deleteGoal(user.uid, confirmDeleteId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkComplete = async (goalId: string) => {
    if (!user) return;
    setCompletingId(goalId);
    try {
      await updateGoal(user.uid, goalId, { completed: true });
    } finally {
      setCompletingId(null);
    }
  };

  const handleUnmarkComplete = async (goalId: string) => {
    if (!user) return;
    setCompletingId(goalId);
    try {
      await updateGoal(user.uid, goalId, { completed: false });
    } finally {
      setCompletingId(null);
    }
  };

  // ── Filtering + sorting pipeline ──────────────────────────────────────────
  const processedGoals = useMemo(() => {
    let list = activeFilter === "All" ? goals : goals.filter((g) => g.type === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.subjectName?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "deadline") return a.deadline.localeCompare(b.deadline);
      if (sortBy === "progress") {
        const pa = (hoursPerGoal[a.id] ?? 0) / a.targetHours;
        const pb = (hoursPerGoal[b.id] ?? 0) / b.targetHours;
        return pb - pa;
      }
      // created: newest first
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [goals, activeFilter, searchQuery, sortBy, hoursPerGoal]);

  const activeGoals    = processedGoals.filter((g) => !g.completed && g.deadline >= today);
  const expiredGoals   = processedGoals.filter((g) => !g.completed && g.deadline < today);
  const completedGoals = processedGoals.filter((g) => g.completed);

  // ── Summary counts (only truly active goals) ───────────────────────────────
  const activeCount    = goals.filter((g) => !g.completed && g.deadline >= today).length;
  const completedCount = goals.filter((g) => g.completed).length;
  const expiredCount   = goals.filter((g) => !g.completed && g.deadline < today).length;
  const completionRate =
    goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

  // ── Misc helpers ──────────────────────────────────────────────────────────
  const filters: FilterType[] = ["All", "daily", "weekly", "monthly", "quarterly", "yearly"];
  const filterLabels: Record<FilterType, string> = {
    All: "All", daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly",
  };

  const typeBadge = (t: Goal["type"]) => ({
    background: `${typeColor[t]}18`,
    color: typeColor[t],
    border: `1px solid ${typeColor[t]}40`,
  });

  // ── Goal card renderer ────────────────────────────────────────────────────
  function GoalCard({ goal, variant }: { goal: Goal; variant: "active" | "expired" | "completed" }) {
    const color = typeColor[goal.type];
    const currentHours = hoursPerGoal[goal.id] ?? 0;
    const exceeded = currentHours > goal.targetHours;
    const pct = Math.min(Math.round((currentHours / goal.targetHours) * 100), 100);
    const remaining = Math.max(goal.targetHours - currentHours, 0);
    const overBy = exceeded ? Math.round((currentHours - goal.targetHours) * 10) / 10 : 0;

    const isCompleted = variant === "completed";
    const isExpired   = variant === "expired";

    return (
      <div
        className={`glass-card p-6 flex flex-col gap-4 transition-all ${
          isCompleted ? "opacity-50" : isExpired ? "opacity-70 border-error/20" : exceeded ? "border-secondary/30" : ""
        }`}
      >
        {/* Top Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-secondary/15 text-secondary border border-secondary/30">
                Completed
              </span>
            ) : isExpired ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-error/15 text-error border border-error/30">
                Expired
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={typeBadge(goal.type)}>
                {goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!isCompleted && exceeded && (
              <span className="flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full bg-secondary/10 text-secondary mr-2">
                <span className="material-symbols-outlined text-[16px]">emoji_events</span>
                Exceeded!
              </span>
            )}
            {!isCompleted && !exceeded && (
              <DeadlineCountdown deadline={goal.deadline} />
            )}

            {/* Mark done / Undo */}
            {!isCompleted ? (
              <button
                onClick={() => handleMarkComplete(goal.id)}
                disabled={completingId === goal.id}
                className="text-on-surface-variant hover:text-secondary transition-colors p-1.5 rounded-lg hover:bg-secondary/10"
                title="Mark as complete"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {completingId === goal.id ? "hourglass_empty" : "check_circle"}
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleUnmarkComplete(goal.id)}
                disabled={completingId === goal.id}
                className="text-on-surface-variant hover:text-tertiary transition-colors p-1.5 rounded-lg hover:bg-tertiary/10"
                title="Restore goal"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {completingId === goal.id ? "hourglass_empty" : "undo"}
                </span>
              </button>
            )}

            <button
              onClick={() => openEdit(goal)}
              className="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10"
              title="Edit goal"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
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
            <span className="text-sm text-on-surface-variant font-medium">{goal.subjectName}</span>
          </div>
        )}

        <div className="flex items-center gap-6">
          <ProgressRing current={currentHours} target={goal.targetHours} color={color} />
          <div className="flex flex-col gap-2 flex-1">
            <span className="font-jetbrains text-xl font-bold" style={{ color: exceeded ? "#5ed8a9" : "#eeeef0" }}>
              {formatHours(currentHours)}
              <span className="text-on-surface-variant text-sm font-normal"> / {goal.targetHours}h target</span>
            </span>
            <div className="progress-track">
              <div
                className="progress-fill transition-all"
                style={{ width: `${pct}%`, backgroundColor: exceeded ? "#5ed8a9" : color }}
              />
            </div>
            {exceeded ? (
              <span className="text-sm font-bold text-secondary">{formatHours(overBy)} over target</span>
            ) : isExpired ? (
              <span className="text-sm text-error">Goal expired — {formatHours(remaining)} short of target</span>
            ) : currentHours === 0 ? (
              <span className="text-sm text-on-surface-variant">Start studying to track progress</span>
            ) : (
              <span className="text-sm text-on-surface-variant">{formatHours(remaining)} to go</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8">
      {/* Action row */}
      <div className="flex items-center justify-between">
        <p className="text-on-surface-variant text-sm font-inter">
          {goals.length === 0
            ? "No goals yet"
            : `${activeCount} active · ${completedCount} completed${expiredCount > 0 ? ` · ${expiredCount} expired` : ""}`}
        </p>
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
            <span className="text-xs text-on-surface-variant font-inter">Active goals</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{activeCount}</span>
        </div>
        <div className="glass-card p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-[28px]">check_circle</span>
            <span className="text-xs text-on-surface-variant font-inter">Completed</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{completedCount}</span>
        </div>
        <div className="glass-card p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[28px]">pie_chart</span>
            <span className="text-xs text-on-surface-variant font-inter">Completion rate</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{completionRate}%</span>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search goals or subjects…"
            className="w-full bg-card border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-on-surface text-sm font-inter placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="bg-card border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface text-sm font-inter focus:outline-none focus:border-primary transition-colors"
          style={{ colorScheme: "dark" }}
        >
          <option value="deadline">Sort: Deadline</option>
          <option value="progress">Sort: Progress</option>
          <option value="created">Sort: Newest</option>
        </select>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              activeFilter === f
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-outline-variant"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Empty state */}
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
        <div className="flex flex-col gap-8">

          {/* ── Active Goals ──────────────────────────────────────────── */}
          {activeGoals.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} variant="active" />
              ))}
            </div>
          )}

          {activeGoals.length === 0 && expiredGoals.length === 0 && completedGoals.length === 0 && (
            <div className="glass-card p-10 text-center text-on-surface-variant font-inter text-sm">
              No goals match your search or filter.
            </div>
          )}

          {/* ── Expired Goals ─────────────────────────────────────────── */}
          {expiredGoals.length > 0 && (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setExpiredOpen((v) => !v)}
                className="flex items-center gap-3 text-left"
              >
                <span
                  className="material-symbols-outlined text-[18px] text-error transition-transform duration-200"
                  style={{ transform: expiredOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  chevron_right
                </span>
                <span className="font-grotesk font-bold text-sm text-error">
                  Expired
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-error/15 text-error">
                  {expiredGoals.length}
                </span>
                <div className="flex-1 h-px bg-error/20" />
              </button>
              {expiredOpen && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {expiredGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} variant="expired" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Completed Goals ───────────────────────────────────────── */}
          {completedGoals.length > 0 && (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setCompletedOpen((v) => !v)}
                className="flex items-center gap-3 text-left"
              >
                <span
                  className="material-symbols-outlined text-[18px] text-secondary transition-transform duration-200"
                  style={{ transform: completedOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  chevron_right
                </span>
                <span className="font-grotesk font-bold text-sm text-secondary">
                  Completed
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-secondary/15 text-secondary">
                  {completedGoals.length}
                </span>
                <div className="flex-1 h-px bg-secondary/20" />
              </button>
              {completedOpen && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {completedGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} variant="completed" />
                  ))}
                </div>
              )}
            </div>
          )}
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
