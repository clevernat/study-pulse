"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getUserSubjects } from "@/lib/firebase/firestore";
import type { Subject } from "@/types";

// ── Color mapping ─────────────────────────────────────────────────────────────

type ColorKey = Subject["color"];

const colorMap: Record<ColorKey, { iconBg: string; iconText: string; chipClass: string; barFill: string }> = {
  primary: {
    iconBg: "bg-primary-container/20",
    iconText: "text-primary",
    chipClass: "chip",
    barFill: "bg-primary",
  },
  secondary: {
    iconBg: "bg-secondary-container/20",
    iconText: "text-secondary",
    chipClass: "chip-secondary",
    barFill: "bg-secondary",
  },
  tertiary: {
    iconBg: "bg-tertiary-container/20",
    iconText: "text-tertiary",
    chipClass: "chip-tertiary",
    barFill: "bg-tertiary",
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserSubjects(user.uid).then((data) => {
      if (data.length > 0) setSubjects(data);
    });
  }, [user]);

  const maxMinutes = Math.max(...subjects.map((s) => s.totalMinutes), 1);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-grotesk font-bold text-3xl text-on-surface">Subjects</h1>
        <button className="bg-primary text-on-primary px-5 py-2 rounded-full font-bold font-grotesk hover:opacity-80 transition-all text-sm">
          + Add Subject
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.length === 0 && (
          <div className="glass-card p-12 text-center text-on-surface-variant font-inter col-span-full">
            No subjects yet. Add your first subject to get started.
          </div>
        )}
        {subjects.map((subject) => {
          const meta = colorMap[subject.color];
          const hours = (subject.totalMinutes / 60).toFixed(1);
          const pct = Math.round((subject.totalMinutes / maxMinutes) * 100);

          return (
            <div key={subject.id} className="glass-card-hover p-6 flex flex-col gap-4">
              {/* Top row: icon + 3-dot menu */}
              <div className="flex items-center justify-between">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.iconBg}`}>
                  <span className={`material-symbols-outlined text-xl ${meta.iconText}`}>
                    {subject.icon}
                  </span>
                </div>
                <button className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container">
                  <span className="material-symbols-outlined text-xl">more_vert</span>
                </button>
              </div>

              {/* Name */}
              <div>
                <h2 className="font-grotesk font-bold text-[18px] text-on-surface leading-tight">
                  {subject.name}
                </h2>
              </div>

              {/* Category chip */}
              <div>
                <span className={meta.chipClass}>{subject.category}</span>
              </div>

              {/* Stats */}
              <div className="flex items-end justify-between">
                <div>
                  <div className={`font-jetbrains font-semibold text-[20px] ${meta.iconText}`}>
                    {hours}h
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">Total Hours</div>
                </div>
                <div className="text-right">
                  <div className="font-jetbrains font-semibold text-[20px] text-on-surface">
                    {subject.sessionCount}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">Sessions</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-track">
                <div
                  className={`progress-fill ${meta.barFill}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Continue link */}
              <Link
                href="/timer"
                className={`text-sm font-semibold font-inter ${meta.iconText} hover:opacity-80 transition-opacity mt-1`}
              >
                Continue →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
