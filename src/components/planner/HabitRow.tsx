"use client";
import { updateItem } from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import { currentStreak, bestStreak, doneOn, periodProgress, scheduleLabel, valueOn, type HabitContext } from "@/lib/habits";
import { addDays } from "@/lib/timetable";
import type { Habit } from "@/types";

/** One habit: check-in button (or +/- for amounts), streak and the last 7 days. */
export default function HabitRow({ uid, habit, today, ctx, onEdit }: { uid: string; habit: Habit; today: string; ctx: HabitContext; onEdit?: () => void }) {
  const c = getColor(habit.color);
  const value = valueOn(habit, today, ctx);
  const done = doneOn(habit, today, ctx);
  const streak = currentStreak(habit, today, ctx);
  const best = bestStreak(habit, today, ctx);
  const prog = periodProgress(habit, today, ctx);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const setValue = (v: number) => updateItem<Habit>(uid, "habits", habit.id, { [`log.${today}`]: Math.max(0, v) } as Partial<Habit>);

  return (
    <div data-testid="habit-item" className="glass-card p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
        <span className="material-symbols-outlined" style={{ color: c.text }}>{habit.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <button onClick={onEdit} className="text-left font-grotesk font-bold text-on-surface truncate block max-w-full hover:text-primary">{habit.title}</button>
        <p className="text-[11px] text-on-surface-variant">
          {[scheduleLabel(habit), habit.autoSource && "automatic",
            habit.schedule.type === "weekly" ? `${prog.done}/${prog.needed} this week` : habit.target > 1 ? `${prog.done}/${prog.needed} today` : ""]
            .filter(Boolean).join(" · ")}
        </p>
        <div className="flex items-center gap-1 mt-1.5" aria-label="Last 7 days">
          {week.map((d) => (
            <span key={d} title={d} className="w-3 h-3 rounded-sm" style={{ background: doneOn(habit, d, ctx) ? c.dot : "#292b30" }} />
          ))}
          <span data-testid="habit-streak" className="ml-2 text-xs font-jetbrains text-on-surface flex items-center gap-0.5" title={`Best: ${best}`}>
            <span className="material-symbols-outlined text-[14px] text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            {streak} {habit.schedule.type === "weekly" ? (streak === 1 ? "week" : "weeks") : streak === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
      {habit.autoSource ? (
        <span className={`material-symbols-outlined ${done ? "text-secondary" : "text-on-surface-variant/40"}`} style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      ) : habit.target > 1 ? (
        <div className="flex items-center gap-1">
          <button aria-label="Less" onClick={() => setValue(value - 1)} className="w-8 h-8 rounded-full border border-outline-variant text-on-surface-variant">−</button>
          <span className="font-jetbrains text-sm w-8 text-center">{value}</span>
          <button aria-label="More" data-testid="habit-plus" onClick={() => setValue(value + 1)} className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container">+</button>
        </div>
      ) : (
        <button data-testid="habit-check" aria-label={done ? `Undo ${habit.title} today` : `Check ${habit.title} today`} aria-pressed={done}
          onClick={() => setValue(done ? 0 : 1)}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${done ? "border-transparent" : "border-outline-variant hover:border-primary"}`}
          style={done ? { background: c.dot } : undefined}>
          {done && <span className="material-symbols-outlined text-[20px] text-background">check</span>}
        </button>
      )}
    </div>
  );
}
