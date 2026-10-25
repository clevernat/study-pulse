"use client";
import { useState } from "react";
import Link from "next/link";
import { useStudyTargets } from "@/lib/firebase/useStudyTargets";
import { targetProgress } from "@/lib/insights";
import { formatSmartDuration, localDateStr } from "@/lib/dateUtils";
import { inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import type { Session } from "@/types";

const toHours = (min: number) => (min ? String(Math.round((min / 60) * 10) / 10) : "");
const toMinutes = (h: string) => Math.max(0, Math.min(24 * 60 * 7, Math.round((parseFloat(h) || 0) * 60)));

/** Daily and weekly target inputs (hours). Empty = no target. */
export function TargetForm({ daily, weekly, onSave, onCancel }: { daily: number; weekly: number; onSave: (d: number, w: number) => Promise<void>; onCancel?: () => void }) {
  const [d, setD] = useState(toHours(daily));
  const [w, setW] = useState(toHours(weekly));
  const [saving, setSaving] = useState(false);
  return (
    <form
      data-testid="target-form"
      className="flex flex-col gap-3"
      onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSave(toMinutes(d), toMinutes(w)); setSaving(false); }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant font-bold">Hours per day</span>
          <input data-testid="target-daily" className={inputCls} type="number" min="0" max="24" step="0.5" value={d} onChange={(e) => setD(e.target.value)} placeholder="e.g. 2" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant font-bold">Hours per week</span>
          <input data-testid="target-weekly" className={inputCls} type="number" min="0" max="168" step="0.5" value={w} onChange={(e) => setW(e.target.value)} placeholder="e.g. 12" />
        </label>
      </div>
      <p className="text-xs text-on-surface-variant">Leave a box empty for no target. A week runs Monday to Sunday.</p>
      <div className="flex gap-2">
        <button data-testid="target-save" type="submit" disabled={saving} className={primaryBtnCls}>{saving ? "Saving…" : "Save target"}</button>
        {onCancel && <button type="button" onClick={onCancel} className={secondaryBtnCls}>Cancel</button>}
      </div>
    </form>
  );
}

function Bar({ pct, done }: { pct: number; done: boolean }) {
  return (
    <div className="h-2 rounded-full bg-surface-container overflow-hidden" role="presentation">
      <div className={`h-full rounded-full transition-all ${done ? "bg-secondary" : "bg-primary-container"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Today's card: progress against your own daily/weekly study target. */
export function TargetCard({ sessions }: { sessions: Session[] }) {
  const { daily, weekly, loaded, save } = useStudyTargets();
  const [editing, setEditing] = useState(false);
  if (!loaded) return null;
  const p = targetProgress(sessions, localDateStr(), daily, weekly);
  const hasTarget = !!(p.daily || p.weekly);

  return (
    <section data-testid="target-card" className="glass-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-grotesk font-bold text-base text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">flag</span>Study target
        </h2>
        {hasTarget && !editing && (
          <button data-testid="target-edit" onClick={() => setEditing(true)} className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-2">Change</button>
        )}
      </div>

      {editing || !hasTarget ? (
        <>
          {!hasTarget && !editing && <p className="text-sm text-on-surface-variant">Set how much you want to study, and see at a glance if you are on track.</p>}
          <TargetForm daily={daily} weekly={weekly} onSave={async (d, w) => { await save(d, w); setEditing(false); }} onCancel={editing ? () => setEditing(false) : undefined} />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {p.daily && (
            <div className="flex flex-col gap-1.5" data-testid="target-daily-progress">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-on-surface">Today: <b className="font-jetbrains">{formatSmartDuration(p.todayMinutes)}</b> of {formatSmartDuration(p.daily.target)}</span>
                <span className={p.daily.left === 0 ? "text-secondary text-xs font-bold" : "text-xs text-on-surface-variant"}>
                  {p.daily.left === 0 ? "Done for today" : `${formatSmartDuration(p.daily.left)} to go`}
                </span>
              </div>
              <Bar pct={p.daily.pct} done={p.daily.left === 0} />
            </div>
          )}
          {p.weekly && (
            <div className="flex flex-col gap-1.5" data-testid="target-weekly-progress">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-on-surface">This week: <b className="font-jetbrains">{formatSmartDuration(p.weekMinutes)}</b> of {formatSmartDuration(p.weekly.target)}</span>
                <span data-testid="target-on-track" className={p.weekly.onTrack ? "text-secondary text-xs font-bold" : "text-tertiary text-xs font-bold"}>
                  {p.weekly.left === 0 ? "Week done" : p.weekly.onTrack ? "On track" : `${formatSmartDuration(p.weekly.expectedByToday - p.weekMinutes)} behind`}
                </span>
              </div>
              <Bar pct={p.weekly.pct} done={p.weekly.left === 0} />
            </div>
          )}
          <Link href="/review" className="text-xs text-primary underline underline-offset-2 self-start">See your weekly review →</Link>
        </div>
      )}
    </section>
  );
}

/** Settings card wrapper around the form. */
export function TargetSettingsCard() {
  const { daily, weekly, loaded, save } = useStudyTargets();
  const [saved, setSaved] = useState(false);
  return (
    <section className="glass-card p-6 flex flex-col gap-3" data-testid="target-settings">
      <h2 className="font-space font-semibold text-on-surface">Study target</h2>
      <p className="text-sm text-on-surface-variant">Shown on Today and on the Timer. Saved to your account, so every device uses it.</p>
      {loaded && <TargetForm key={`${daily}-${weekly}`} daily={daily} weekly={weekly} onSave={async (d, w) => { await save(d, w); setSaved(true); }} />}
      {saved && <p role="status" className="text-sm text-secondary">Saved.</p>}
    </section>
  );
}
