"use client";
import { useState } from "react";
import Link from "next/link";
import { useStudyTargets } from "@/lib/firebase/useStudyTargets";
import { useCollection } from "@/lib/firebase/useCollection";
import { updateItem } from "@/lib/firebase/firestore";
import { subjectTargets, targetProgress, type TargetProgress } from "@/lib/insights";
import { getColor } from "@/lib/colorPalette";
import { useNewSubject } from "@/components/ui/NewSubject";
import { formatSmartDuration, localDateStr } from "@/lib/dateUtils";
import { inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import type { Session, Subject } from "@/types";

const toHours = (min: number) => (min ? String(Math.round((min / 60) * 10) / 10) : "");
const toMinutes = (h: string) => Math.max(0, Math.min(24 * 60 * 7, Math.round((parseFloat(h) || 0) * 60)));

/** Daily and weekly target inputs (hours). Empty = no target. */
export function TargetForm({ daily, weekly, onSave, onCancel, saveLabel = "Save target" }: { daily: number; weekly: number; onSave: (d: number, w: number) => Promise<void>; onCancel?: () => void; saveLabel?: string }) {
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
        <button data-testid="target-save" type="submit" disabled={saving} className={primaryBtnCls}>{saving ? "Saving…" : saveLabel}</button>
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

/** Today / this week bars for one target. `compact` = smaller text, testids only on the main card. */
function TargetRows({ p, compact }: { p: TargetProgress; compact?: boolean }) {
  return (
    <>
      {p.daily && (
        <div className="flex flex-col gap-1.5" data-testid={compact ? undefined : "target-daily-progress"}>
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
        <div className="flex flex-col gap-1.5" data-testid={compact ? undefined : "target-weekly-progress"}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-on-surface">This week: <b className="font-jetbrains">{formatSmartDuration(p.weekMinutes)}</b> of {formatSmartDuration(p.weekly.target)}</span>
            <span data-testid={compact ? undefined : "target-on-track"} className={p.weekly.onTrack ? "text-secondary text-xs font-bold" : "text-tertiary text-xs font-bold"}>
              {p.weekly.left === 0 ? "Week done" : p.weekly.onTrack ? "On track" : `${formatSmartDuration(p.weekly.expectedByToday - p.weekMinutes)} behind`}
            </span>
          </div>
          <Bar pct={p.weekly.pct} done={p.weekly.left === 0} />
        </div>
      )}
    </>
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
          <span className="flex gap-3">
            <button data-testid="target-edit" onClick={() => setEditing(true)} className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-2">Change</button>
            <button data-testid="target-remove" onClick={() => save(0, 0)} className="text-xs text-on-surface-variant hover:text-error underline underline-offset-2">Remove</button>
          </span>
        )}
      </div>

      <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant -mb-1">All subjects</h3>
      {editing || !hasTarget ? (
        <>
          {!hasTarget && !editing && <p className="text-sm text-on-surface-variant">Your total study time, and whether you are on track. Leave it empty if you only want subject targets.</p>}
          <TargetForm daily={daily} weekly={weekly} onSave={async (d, w) => { await save(d, w); setEditing(false); }} onCancel={editing ? () => setEditing(false) : undefined} />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <TargetRows p={p} />
          <Link href="/review" className="text-xs text-primary underline underline-offset-2 self-start">See your weekly review →</Link>
        </div>
      )}
      <SubjectTargets />
    </section>
  );
}

/** Targets for single subjects: "Biology, 5 hours a week". Saved on the subject itself. */
export function SubjectTargets() {
  const { items: subjects, uid } = useCollection<Subject>("subjects");
  const { items: sessions } = useCollection<Session>("sessions");
  const [editing, setEditing] = useState<string | null>(null); // subject id, or "new"
  const [pick, setPick] = useState("");
  const newSubject = useNewSubject((id) => setPick(id));
  const rows = subjectTargets(sessions, subjects, localDateStr());
  const free = subjects.filter((s) => !rows.some((r) => r.subject.id === s.id));
  const save = (id: string) => async (d: number, w: number) => {
    await updateItem<Subject>(uid, "subjects", id, { dailyTargetMinutes: d || undefined, weeklyTargetMinutes: w || undefined });
    setEditing(null);
    setPick("");
  };
  const chosen = pick || free[0]?.id || "";

  return (
    <div data-testid="subject-targets" className="flex flex-col gap-3 border-t border-outline-variant pt-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">By subject</h3>
      {rows.length === 0 && editing !== "new" && <p className="text-sm text-on-surface-variant">Give a subject its own target, for example 5 hours of Biology a week.</p>}
      <ul className="flex flex-col gap-4">
        {rows.map(({ subject, ...p }) => (
          <li key={subject.id} data-testid="subject-target" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getColor(subject.color).dot }} />
              <span className="font-semibold text-sm text-on-surface flex-1 truncate">{subject.name}</span>
              {editing !== subject.id && (
                <>
                  <button onClick={() => setEditing(subject.id)} aria-label={`Change ${subject.name} target`} className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-2">Change</button>
                  <button onClick={() => save(subject.id)(0, 0)} aria-label={`Remove ${subject.name} target`} data-testid="subject-target-remove" className="text-xs text-on-surface-variant hover:text-error underline underline-offset-2">Remove</button>
                </>
              )}
            </div>
            {editing === subject.id
              ? <TargetForm daily={subject.dailyTargetMinutes ?? 0} weekly={subject.weeklyTargetMinutes ?? 0} onSave={save(subject.id)} onCancel={() => setEditing(null)} />
              : <TargetRows p={p} compact />}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <div data-testid="subject-target-new" className="flex flex-col gap-3 rounded-xl border border-outline-variant p-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-on-surface-variant font-bold">Subject</span>
            <select data-testid="subject-target-subject" className={inputCls} value={chosen} onChange={(e) => newSubject.pick(e.target.value) || setPick(e.target.value)}>
              {free.length === 0 && <option value="">No subject without a target</option>}
              {free.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              {newSubject.option}
            </select>
          </label>
          {newSubject.form}
          {chosen && <TargetForm key={chosen} daily={0} weekly={0} onSave={save(chosen)} onCancel={() => { setEditing(null); setPick(""); }} saveLabel="Add target" />}
          {!chosen && <button type="button" onClick={() => setEditing(null)} className={`${secondaryBtnCls} self-start`}>Cancel</button>}
        </div>
      ) : (
        <button data-testid="subject-target-add" onClick={() => setEditing("new")} className="self-start inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>Add a subject target
        </button>
      )}
    </div>
  );
}

/** Settings card wrapper around the form. */
export function TargetSettingsCard() {
  const { daily, weekly, loaded, save } = useStudyTargets();
  const [saved, setSaved] = useState(false);
  return (
    <section className="glass-card p-6 flex flex-col gap-3" data-testid="target-settings">
      <h2 className="font-space font-semibold text-on-surface">Study target</h2>
      <p className="text-sm text-on-surface-variant">For all subjects together, plus targets for single subjects. Shown on Today, the Timer and Progress.</p>
      {loaded && <TargetForm key={`${daily}-${weekly}`} daily={daily} weekly={weekly} onSave={async (d, w) => { await save(d, w); setSaved(true); }} />}
      {saved && <p role="status" className="text-sm text-secondary">Saved.</p>}
      <SubjectTargets />
    </section>
  );
}
