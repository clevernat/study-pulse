import type { ReactNode } from "react";

export interface Stat { value: ReactNode; label: string; testId?: string }

/** A quiet row of key numbers: one surface, columns split by hairlines (no card per number). */
export default function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="glass-card grid grid-flow-col auto-cols-fr divide-x divide-outline-variant">
      {stats.map((s) => (
        <div key={s.label} className="px-3 md:px-6 py-3.5 min-w-0 flex flex-col-reverse">
          <dt className="text-xs md:text-sm text-on-surface-variant leading-snug">{s.label}</dt>
          <dd data-testid={s.testId} className="font-jetbrains font-semibold text-xl md:text-2xl text-on-surface truncate">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
