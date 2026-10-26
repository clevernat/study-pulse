"use client";
import Modal from "@/components/ui/Modal";
import { getColor } from "@/lib/colorPalette";
import { formatSmartDuration } from "@/lib/dateUtils";
import { ratingColor } from "@/components/ui/FocusBadge";
import { Avatar, DayBars, HBars, Ring } from "./charts";
import type { Signal } from "@/lib/progress";
import type { TeamRow } from "./useTeam";

const KIND = {
  good: "bg-secondary/10 text-secondary border-secondary/25",
  watch: "bg-tertiary/10 text-tertiary border-tertiary/25",
  info: "bg-surface-container text-on-surface-variant border-outline-variant",
} as const;

export function SignalChip({ s }: { s: Signal }) {
  return (
    <span data-testid={`signal-${s.kind}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${KIND[s.kind]}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[13px]">{s.icon}</span>{s.text}
    </span>
  );
}

export function updatedAgo(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} hr${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

/** One person's progress, big and visual. */
export default function MemberDetail({ row, today, onClose }: { row: TeamRow; today: string; onClose: () => void }) {
  const { member: m, progress: p } = row;
  return (
    <Modal title={m.name} onClose={onClose} wide testId="member-detail">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Avatar name={m.name} color={row.color} size={52} />
          <div className="min-w-0">
            <p className="text-sm text-on-surface truncate">{m.email}{m.username ? <span className="text-on-surface-variant"> · @{m.username}</span> : null}</p>
            <p className="text-xs text-on-surface-variant">{m.role === "admin" ? "Admin" : "Member"} · joined {new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{p ? ` · updated ${updatedAgo(p.updatedAt)}` : ""}</p>
          </div>
        </div>

        {!p ? (
          <p className="text-sm text-on-surface-variant">No progress yet. It appears after {m.name} opens StudyPulse.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Last 7 days", value: formatSmartDuration(row.last7) },
                { label: "All time", value: formatSmartDuration(p.totalMinutes) },
                { label: "Streak", value: `${p.streak} day${p.streak === 1 ? "" : "s"}`, sub: `best ${p.longestStreak}` },
                { label: "Focus", value: p.rating !== null ? `${p.rating}/5` : "–", cls: p.rating !== null ? ratingColor(p.rating) : "" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-surface-container-lowest border border-outline-variant px-3 py-2.5 flex flex-col-reverse">
                  <dt className="text-[11px] text-on-surface-variant">{s.label}{s.sub ? ` · ${s.sub}` : ""}</dt>
                  <dd className={`font-jetbrains font-bold text-lg text-on-surface ${s.cls ?? ""}`}>{s.value}</dd>
                </div>
              ))}
            </dl>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Last 14 days</h3>
              <DayBars series={[{ name: m.name, color: row.color, values: row.days }]} today={today} height={120} />
            </section>

            <section className="grid grid-cols-3 gap-2">
              <Ring pct={p.topics.total ? p.topics.done / p.topics.total : 0} color="#40efb7" value={p.topics.total ? `${Math.round((p.topics.done / p.topics.total) * 100)}%` : "–"} label={`Topics covered (${p.topics.done}/${p.topics.total})`} />
              <Ring pct={p.goals.done + p.goals.active ? p.goals.done / (p.goals.done + p.goals.active) : 0} color="#7c3aed" value={`${p.goals.done}/${p.goals.done + p.goals.active}`} label="Goals reached" />
              <Ring pct={p.results ? p.results.avgPct / 100 : 0} color="#ffb95f" value={p.results ? `${p.results.avgPct}%` : "–"} label={p.results ? `Test average (${p.results.count})` : "No test scores"} />
            </section>

            {p.subjects.some((s) => s.minutes) && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Time per subject</h3>
                <HBars rows={p.subjects.filter((s) => s.minutes).map((s) => ({ label: s.name, color: getColor(s.color).dot, minutes: s.minutes }))} />
                {p.subjects.some((s) => s.weeklyTarget) && (
                  <p data-testid="member-subject-targets" className="text-xs text-on-surface-variant">
                    Subject targets this week: {p.subjects.filter((s) => s.weeklyTarget).map((s) => `${s.name} ${formatSmartDuration(s.weekMinutes)} of ${formatSmartDuration(s.weeklyTarget!)}`).join(" · ")}
                  </p>
                )}
              </section>
            )}

            <section className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-outline-variant p-3 flex items-center gap-3">
                <span aria-hidden="true" className="material-symbols-outlined text-primary">event</span>
                <span className="text-on-surface">{p.nextExam ? <>Next exam: <b>{p.nextExam.title}</b> in {daysUntil(p.nextExam.date, today)} days</> : "No exams planned"}</span>
              </div>
              <div className="rounded-xl border border-outline-variant p-3 flex items-center gap-3">
                <span aria-hidden="true" className="material-symbols-outlined text-primary">track_changes</span>
                <span className="text-on-surface">{p.target.daily || p.target.weekly ? <>Target: {[p.target.daily && `${formatSmartDuration(p.target.daily)} a day`, p.target.weekly && `${formatSmartDuration(p.target.weekly)} a week`].filter(Boolean).join(", ")}</> : "No study target set"}</span>
              </div>
            </section>

            {row.signals.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">What stands out</h3>
                <div className="flex flex-wrap gap-1.5">{row.signals.map((s) => <SignalChip key={s.text} s={s} />)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
