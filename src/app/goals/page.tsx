"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserGoals } from "@/lib/firebase/firestore";
import { Goal } from "@/types";

const colorMap: Record<Goal["type"], string> = {
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
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <span className="absolute font-jetbrains text-[13px] font-bold text-on-surface">{pct}%</span>
    </div>
  );
}

type FilterType = "All" | "daily" | "weekly" | "monthly";

export default function GoalsPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserGoals(user.uid).then((data) => {
      if (data.length > 0) setGoals(data);
    });
  }, [user]);

  const activeCount = goals.filter((g) => !g.completed).length;
  const completedCount = goals.filter((g) => g.completed).length;
  const completionRate = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

  const filteredGoals =
    activeFilter === "All" ? goals : goals.filter((g) => g.type === activeFilter);

  const filters: FilterType[] = ["All", "daily", "weekly", "monthly"];
  const filterLabels: Record<FilterType, string> = {
    All: "All",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  return (
    <div className="p-xl">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-xl">
        <h2 className="font-grotesk text-2xl font-bold text-on-surface">Study Goals</h2>
        <button className="bg-primary text-on-primary px-lg py-sm rounded-full font-bold flex items-center gap-xs hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[18px]">add</span>
          + New Goal
        </button>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-3 gap-lg mb-xl">
        {/* Active Goals */}
        <div className="glass-card p-lg flex flex-col gap-sm">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-[28px]">track_changes</span>
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-inter">Active Goals</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{activeCount}</span>
        </div>

        {/* Completed */}
        <div className="glass-card p-lg flex flex-col gap-sm">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-secondary text-[28px]">check_circle</span>
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-inter">Completed</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{completedCount}</span>
        </div>

        {/* Completion Rate */}
        <div className="glass-card p-lg flex flex-col gap-sm">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-tertiary text-[28px]">pie_chart</span>
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-inter">Completion Rate</span>
          </div>
          <span className="font-jetbrains text-3xl font-bold text-on-surface">{completionRate}%</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-sm mb-lg">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-md py-sm rounded-full text-sm font-bold transition-all ${
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {goals.length === 0 && (
          <div className="glass-card p-12 text-center text-on-surface-variant font-inter col-span-full">
            No goals set yet. Add your first goal in Settings.
          </div>
        )}
        {filteredGoals.map((goal) => {
          const color = colorMap[goal.type];
          const pct = Math.min(Math.round((goal.currentHours / goal.targetHours) * 100), 100);
          const remaining = Math.max(goal.targetHours - goal.currentHours, 0);

          const typeBadgeClass =
            goal.type === "daily"
              ? "chip"
              : goal.type === "weekly"
              ? "chip-secondary"
              : "chip-tertiary";

          return (
            <div key={goal.id} className="glass-card p-lg flex flex-col gap-md">
              {/* Top Row */}
              <div className="flex items-center justify-between">
                <span className={typeBadgeClass}>{goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}</span>
                {goal.completed ? (
                  <span className="flex items-center gap-xs text-sm font-bold px-sm py-xs rounded-full bg-secondary/10 text-secondary">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Done
                  </span>
                ) : (
                  <span className="text-sm text-on-surface-variant">
                    Due {goal.deadline}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-grotesk text-[18px] font-bold text-on-surface">{goal.title}</h3>

              {/* Subject Tag */}
              {goal.subjectName && (
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">menu_book</span>
                  <span className="text-sm text-on-surface-variant">{goal.subjectName}</span>
                </div>
              )}

              {/* Progress Ring + Hours */}
              <div className="flex items-center gap-lg">
                <ProgressRing current={goal.currentHours} target={goal.targetHours} color={color} />
                <div className="flex flex-col gap-xs">
                  <span className="font-jetbrains text-xl font-bold text-on-surface">
                    {goal.currentHours}
                    <span className="text-on-surface-variant text-sm font-normal"> / {goal.targetHours}h</span>
                  </span>
                  {/* Progress Bar */}
                  <div className="progress-track w-40">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  {/* Bottom status */}
                  {goal.completed ? (
                    <span className="text-sm font-bold text-secondary">Goal Achieved! 🎯</span>
                  ) : (
                    <span className="text-sm text-on-surface-variant">
                      {remaining.toFixed(1)}h remaining
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
