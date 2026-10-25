"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/firebase/useCollection";
import { useStudyTargets } from "@/lib/firebase/useStudyTargets";
import { buildProgress, signals } from "@/lib/progress";
import { goalHours, targetProgress } from "@/lib/insights";
import { formatSmartDuration, localDateStr } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import { Ring } from "@/components/admin/charts";
import { SignalChip } from "@/components/admin/MemberDetail";
import type { Exam, Goal, Session, Subject, TestResult, Topic } from "@/types";

/** "What you do well" and "Goals ahead" on the Progress overview: the same signals admins see. */
export default function GoalsAhead({ sessions, subjects }: { sessions: Session[]; subjects: Subject[] }) {
  const { member } = useAuth();
  const { items: goals } = useCollection<Goal>("goals");
  const { items: exams } = useCollection<Exam>("exams");
  const { items: results } = useCollection<TestResult>("results");
  const { items: topics } = useCollection<Topic>("topics");
  const target = useStudyTargets();
  const today = localDateStr();

  const list = useMemo(() => {
    const now = Date.now();
    const p = buildProgress({ name: member?.name ?? "", email: member?.email ?? "", sessions, subjects, goals, exams, results, topics, target: { daily: target.daily, weekly: target.weekly } }, today, now);
    return signals(p, now);
  }, [member, sessions, subjects, goals, exams, results, topics, target.daily, target.weekly, today]);

  const t = targetProgress(sessions, today, target.daily, target.weekly);
  const active = goals
    .filter((g) => !g.completed && g.deadline >= today)
    .map((g) => ({ g, hours: goalHours(g, sessions) }))
    .filter((x) => x.hours < x.g.targetHours)
    .sort((a, b) => a.g.deadline.localeCompare(b.g.deadline))
    .slice(0, 4);
  const good = list.filter((s) => s.kind !== "watch");
  const watch = list.filter((s) => s.kind === "watch");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section data-testid="strengths" className="glass-card p-5 flex flex-col gap-4">
        <h2 className="font-grotesk font-bold text-lg text-on-surface flex items-center gap-2"><span aria-hidden="true" className="material-symbols-outlined text-secondary">emoji_events</span>What you do well</h2>
        {good.length ? <div className="flex flex-wrap gap-2">{good.map((s) => <SignalChip key={s.text} s={s} />)}</div>
          : <p className="text-sm text-on-surface-variant">Study a few sessions and rate your focus to see your strengths here.</p>}
        {watch.length > 0 && (
          <>
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">To work on</h3>
            <div className="flex flex-wrap gap-2">{watch.map((s) => <SignalChip key={s.text} s={s} />)}</div>
          </>
        )}
      </section>

      <section data-testid="goals-ahead" className="glass-card p-5 flex flex-col gap-4">
        <h2 className="font-grotesk font-bold text-lg text-on-surface flex items-center gap-2"><span aria-hidden="true" className="material-symbols-outlined text-primary">flag</span>Goals ahead</h2>
        {t.daily || t.weekly ? (
          <div className="flex justify-around">
            {t.daily && <Ring pct={t.daily.pct / 100} color="#40efb7" value={`${t.daily.pct}%`} label={`Today: ${formatSmartDuration(t.todayMinutes)} of ${formatSmartDuration(t.daily.target)}`} />}
            {t.weekly && <Ring pct={t.weekly.pct / 100} color="#7c3aed" value={`${t.weekly.pct}%`} label={`This week: ${formatSmartDuration(t.weekMinutes)} of ${formatSmartDuration(t.weekly.target)}`} />}
          </div>
        ) : (
          <Link href="/today" className="text-sm text-primary underline underline-offset-2">Set a daily or weekly study target</Link>
        )}
        {active.length ? (
          <ul className="flex flex-col gap-3">
            {active.map(({ g, hours }) => {
              const pct = Math.min(100, Math.round((hours / g.targetHours) * 100));
              const left = Math.round((Date.parse(g.deadline) - Date.parse(today)) / 86_400_000);
              const color = getColor(subjects.find((s) => s.id === g.subjectId)?.color ?? "violet").dot;
              return (
                <li key={g.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-on-surface truncate">{g.title}</span>
                    <span className="text-xs text-on-surface-variant shrink-0">{left === 0 ? "due today" : `${left} day${left === 1 ? "" : "s"} left`}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#292b30] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
                  <span className="text-[11px] text-on-surface-variant">{formatSmartDuration(Math.round(hours * 60))} of {formatSmartDuration(g.targetHours * 60)} · {pct}%</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">No open goals. <Link href="/goals" className="text-primary underline underline-offset-2">Make one</Link> to see it here.</p>
        )}
      </section>
    </div>
  );
}
