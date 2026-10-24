"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/firebase/useCollection";
import { useComingCards, useReviewDays, countCards } from "@/lib/firebase/useFlashcards";
import { forecast } from "@/lib/flashcards/stats";
import { dayTotals, retentionSince } from "@/lib/flashcards/reviewDays";
import { dayBounds } from "@/lib/flashcards/queue";
import { localDateStr, daysAgoStr } from "@/lib/dateUtils";
import { inputCls } from "@/components/ui/Field";
import type { Deck } from "@/types";

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="glass-card p-4">
      <p className="font-jetbrains text-2xl text-on-surface" data-testid={testId}>{value}</p>
      <p className="text-xs text-on-surface-variant mt-1">{label}</p>
    </div>
  );
}

interface Counts { total: number; new: number; learning: number; mature: number; suspended: number }

/** Card counts with count queries (cheap: 1 read per 1,000 cards). */
function useCardCounts(deckId: string, refresh: number): Counts | null {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    if (!user) return;
    const deck = deckId ? [where("deckId", "==", deckId)] : [];
    const c = (...f: Parameters<typeof where>[]) => countCards(user.uid, ...deck, ...f.map((args) => where(...args)));
    Promise.all([c(), c(["state", "==", 0]), c(["state", "in", [1, 3]]), c(["state", "==", 2], ["scheduled_days", ">=", 21]), c(["suspended", "==", true])])
      .then(([total, n, learning, mature, suspended]) => setCounts({ total, new: n, learning, mature, suspended }))
      .catch((err) => console.error("Counting cards failed:", err));
  }, [user, deckId, refresh]);
  return counts;
}

export default function FlashcardStatsPage() {
  const decks = useCollection<Deck>("decks").items;
  const days = useReviewDays().items;
  const [deckId, setDeckId] = useState("");
  const coming = useComingCards(30).items.filter((c) => !deckId || c.deckId === deckId);
  const today = localDateStr();
  const todayDay = days.find((d) => d.id === today);
  const counts = useCardCounts(deckId, todayDay?.count ?? 0);

  const totals = dayTotals(todayDay);
  const { start } = dayBounds(new Date());
  const starts = Array.from({ length: 30 }, (_, i) => new Date(new Date(start).setDate(new Date(start).getDate() + i)).getTime());
  const fc = forecast(coming, starts);
  const fcMax = Math.max(1, ...fc);
  const week = retentionSince(days, daysAgoStr(6));
  const month = retentionSince(days, daysAgoStr(29));
  const perDay = Object.fromEntries(days.map((d) => [d.id, d.count ?? 0]));
  const heat = Array.from({ length: 91 }, (_, i) => daysAgoStr(90 - i));
  const heatMax = Math.max(1, ...heat.map((d) => perDay[d] ?? 0));
  const young = counts ? Math.max(0, counts.total - counts.new - counts.learning - counts.mature) : 0;

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/flashcards" aria-label="Back to Flashcards" className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">arrow_back</span></Link>
        <select aria-label="Deck" className={`${inputCls} !w-auto`} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
          <option value="">All decks</option>
          {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {deckId && <span className="text-xs text-on-surface-variant">The deck choice changes cards and forecast. Answers and retention are for all decks.</span>}
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Cards today" value={String(totals.cards)} testId="stats-today-cards" />
        <Stat label="Minutes today" value={String(totals.minutes)} />
        <Stat label="Again today" value={totals.cards ? `${totals.againPct}%` : "—"} testId="stats-today-again" />
        <Stat label="Remembered (30 days)" value={month.total ? `${month.pct}%` : "—"} testId="stats-retention" />
      </section>

      <section className="glass-card p-5" data-testid="stats-forecast">
        <h2 className="font-grotesk font-bold text-on-surface">Coming reviews (next 30 days)</h2>
        <p className="text-xs text-on-surface-variant mb-3">Cards due each day if you keep up. Day 1 includes overdue cards. Total: {fc.reduce((a, b) => a + b, 0)}</p>
        <div className="flex items-end gap-[3px] h-32" role="img" aria-label="Review forecast">
          {fc.map((n, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${new Date(starts[i]).toLocaleDateString()}: ${n} cards`}>
              <div className={`rounded-t-sm ${i === 0 ? "bg-secondary" : "bg-primary/60"}`} style={{ height: `${(n / fcMax) * 100}%`, minHeight: n ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-on-surface-variant font-jetbrains mt-1"><span>Today</span><span>+15d</span><span>+29d</span></div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5" data-testid="stats-counts">
          <h2 className="font-grotesk font-bold text-on-surface mb-3">Cards ({counts?.total ?? "…"})</h2>
          {([["New", counts?.new, "#a7b2f7"], ["Learning", counts?.learning, "#ffb4ab"], ["Young (< 21 days)", counts ? young : undefined, "#5ed8a9"], ["Mature (21+ days)", counts?.mature, "#3fbe90"], ["Suspended (counted above too)", counts?.suspended, "#ffb95f"]] as const).map(([label, n, color]) => (
            <div key={label} className="flex items-center gap-3 text-sm py-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="flex-1 text-on-surface-variant">{label}</span>
              <span className="font-jetbrains text-on-surface">{n ?? "…"}</span>
            </div>
          ))}
        </div>
        <div className="glass-card p-5">
          <h2 className="font-grotesk font-bold text-on-surface mb-1">Remembered on review</h2>
          <p className="text-xs text-on-surface-variant mb-3">First answer of the day on cards in review. Again = forgotten.</p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div><p className="font-jetbrains text-xl text-on-surface">{week.total ? `${week.pct}%` : "—"}</p><p className="text-[11px] text-on-surface-variant">Last 7 days ({week.total})</p></div>
            <div><p className="font-jetbrains text-xl text-on-surface">{month.total ? `${month.pct}%` : "—"}</p><p className="text-[11px] text-on-surface-variant">Last 30 days ({month.total})</p></div>
          </div>
        </div>
      </section>

      <section className="glass-card p-5">
        <h2 className="font-grotesk font-bold text-on-surface mb-3">Review days (last 13 weeks)</h2>
        <div className="grid grid-flow-col grid-rows-7 gap-1 w-fit max-w-full overflow-x-auto">
          {heat.map((d) => {
            const n = perDay[d] ?? 0;
            return <span key={d} title={`${d}: ${n}`} className="w-3 h-3 rounded-sm" style={{ background: n ? `rgba(94, 216, 169,${0.2 + 0.8 * (n / heatMax)})` : "#1f1f27" }} />;
          })}
        </div>
      </section>
    </div>
  );
}
