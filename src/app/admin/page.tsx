"use client";
import { useState } from "react";
import Link from "next/link";
import AdminOnly from "@/components/admin/AdminOnly";
import { useTeam, type TeamRow } from "@/components/admin/useTeam";
import MemberDetail, { SignalChip, updatedAgo } from "@/components/admin/MemberDetail";
import { Avatar, DayBars, Sparkline } from "@/components/admin/charts";
import { formatSmartDuration } from "@/lib/dateUtils";
import { primaryBtnCls } from "@/components/ui/Field";

function Tile({ icon, label, value, sub, children, testId }: { icon: string; label: string; value: string; sub?: React.ReactNode; children?: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="glass-card p-4 md:p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 text-on-surface-variant text-xs md:text-sm">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">{icon}</span>{label}
      </div>
      <p className="font-jetbrains font-bold text-2xl md:text-3xl text-on-surface truncate" data-testid={testId ? `${testId}-value` : undefined}>{value}</p>
      {sub && <div className="text-xs text-on-surface-variant">{sub}</div>}
      {children}
    </div>
  );
}

function Change({ now, before }: { now: number; before: number }) {
  if (!before) return <span>{now ? "first active week" : "no study yet"}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  return <span className={pct >= 0 ? "text-secondary font-bold" : "text-tertiary font-bold"}>{pct >= 0 ? "+" : "−"}{Math.abs(pct)}% vs the week before</span>;
}

function MemberCard({ row, rank, onOpen }: { row: TeamRow; rank: number; onOpen: () => void }) {
  const { member: m, progress: p } = row;
  const good = row.signals.filter((s) => s.kind === "good").slice(0, 2);
  const watch = row.signals.find((s) => s.kind === "watch");
  return (
    <button onClick={onOpen} data-testid="team-card" aria-label={`Open ${m.name}'s progress`}
      className="glass-card p-4 flex flex-col gap-3 text-left hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-center gap-3 w-full">
        <div className="relative">
          <Avatar name={m.name} color={row.color} />
          {rank <= 3 && row.last7 > 0 && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-outline-variant text-[10px] font-bold flex items-center justify-center text-on-surface">{rank}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-grotesk font-bold text-on-surface truncate">{m.name}</p>
          <p className="text-xs text-on-surface-variant truncate">{m.username ? `@${m.username}` : m.email}</p>
        </div>
        {m.role === "admin" && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">Admin</span>}
      </div>
      <div className="flex items-end justify-between gap-3 w-full">
        <div>
          <p className="font-jetbrains font-bold text-2xl text-on-surface" data-testid="team-card-week">{formatSmartDuration(row.last7)}</p>
          <p className="text-[11px] text-on-surface-variant">last 7 days{p?.streak ? ` · ${p.streak}-day streak` : ""}</p>
        </div>
        <Sparkline values={row.days} color={row.color} />
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[22px]">
        {good.map((s) => <SignalChip key={s.text} s={s} />)}
        {watch && <SignalChip s={watch} />}
        {!p && <span className="text-[11px] text-on-surface-variant">Has not opened StudyPulse yet</span>}
      </div>
      {p && <p className="text-[10px] text-on-surface-variant/70">Updated {updatedAgo(p.updatedAt)}</p>}
    </button>
  );
}

function TeamPage() {
  const { rows, invites, today, loading } = useTeam();
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;

  const last7 = rows.reduce((n, r) => n + r.last7, 0);
  const prev7 = rows.reduce((n, r) => n + r.prev7, 0);
  const active = rows.filter((r) => r.last7 > 0).length;
  const rated = rows.filter((r) => r.progress?.rating != null);
  const focus = rated.length ? Math.round((rated.reduce((n, r) => n + r.progress!.rating!, 0) / rated.length) * 10) / 10 : null;
  const admins = rows.filter((r) => r.member.role === "admin").length;
  const needs = rows.filter((r) => r.signals.some((s) => s.kind === "watch"));
  const openRow = rows.find((r) => r.member.id === open);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-grotesk font-bold text-2xl md:text-3xl text-on-surface">Team progress</h1>
          <p className="text-sm text-on-surface-variant">Everyone&apos;s study time, focus and goals. Tap a person to see more.</p>
        </div>
        <Link href="/admin/people" className={primaryBtnCls}><span aria-hidden="true" className="material-symbols-outlined text-[18px]">person_add</span>Invite someone</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Tile icon="group" label="People" value={String(rows.length)} testId="kpi-people"
          sub={`${admins} admin${admins === 1 ? "" : "s"}${invites.length ? ` · ${invites.length} invite${invites.length === 1 ? "" : "s"} waiting` : ""}`} />
        <Tile icon="schedule" label="Studied, last 7 days" value={formatSmartDuration(last7)} testId="kpi-hours" sub={<Change now={last7} before={prev7} />} />
        <Tile icon="bolt" label="Active this week" value={`${active} of ${rows.length}`} testId="kpi-active">
          <div className="flex gap-1" aria-hidden="true">{rows.map((r) => <span key={r.member.id} className="h-1.5 flex-1 rounded-full" style={{ background: r.last7 ? r.color : "#292b30" }} />)}</div>
        </Tile>
        <Tile icon="psychology" label="Average focus" value={focus !== null ? `${focus}/5` : "–"} testId="kpi-focus">
          <div className="flex gap-1" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: focus !== null && i <= Math.round(focus) ? "#40efb7" : "#292b30" }} />)}</div>
        </Tile>
      </div>

      <section className="glass-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-grotesk font-bold text-lg text-on-surface">Team study time, last 14 days</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
            {rows.filter((r) => r.days.some(Boolean)).map((r) => (
              <li key={r.member.id} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: r.color }} />{r.member.name}</li>
            ))}
          </ul>
        </div>
        <DayBars testId="team-chart" today={today} series={rows.map((r) => ({ name: r.member.name, color: r.color, values: r.days }))} />
      </section>

      {needs.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="team-needs">
          <h2 className="font-grotesk font-bold text-lg text-on-surface flex items-center gap-2"><span aria-hidden="true" className="material-symbols-outlined text-tertiary">flag</span>Needs a look</h2>
          <ul className="glass-card divide-y divide-outline-variant/50">
            {needs.map((r) => (
              <li key={r.member.id}>
                <button onClick={() => setOpen(r.member.id)} className="w-full flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-surface-container/40">
                  <Avatar name={r.member.name} color={r.color} size={32} />
                  <span className="font-semibold text-on-surface text-sm flex-1 min-w-[6rem] truncate">{r.member.name}</span>
                  <span className="flex flex-wrap gap-1.5 sm:justify-end w-full sm:w-auto">{r.signals.filter((s) => s.kind === "watch").map((s) => <SignalChip key={s.text} s={s} />)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Leaderboard</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {rows.map((r, i) => <MemberCard key={r.member.id} row={r} rank={i + 1} onOpen={() => setOpen(r.member.id)} />)}
        </div>
      </section>

      {openRow && <MemberDetail row={openRow} today={today} onClose={() => setOpen(null)} />}
    </div>
  );
}

export default function AdminPage() {
  return <AdminOnly><TeamPage /></AdminOnly>;
}
