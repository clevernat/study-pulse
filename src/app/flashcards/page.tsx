"use client";
import { useState } from "react";
import Link from "next/link";
import { useStudyCards, useDeckTotals, useReviewDays } from "@/lib/firebase/useFlashcards";
import { useCollection } from "@/lib/firebase/useCollection";
import { buildQueue } from "@/lib/flashcards/queue";
import { dayTotals } from "@/lib/flashcards/reviewDays";
import { localDateStr } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import DeckModal from "@/components/flashcards/DeckModal";
import { EmptyState, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import type { Subject } from "@/types";

export default function FlashcardsPage() {
  const { uid, decks, cards, logsToday, loading } = useStudyCards();
  const totals = useDeckTotals(decks.map((d) => d.id), logsToday.length);
  const reviewDays = useReviewDays().items;
  const { items: subjects } = useCollection<Subject>("subjects");
  const [creating, setCreating] = useState(false);
  const now = new Date();
  const today = localDateStr(now);
  const all = buildQueue(cards, decks, logsToday, now, today);
  const due = all.counts.learning + all.counts.review + all.counts.new;
  const stats = dayTotals(reviewDays.find((d) => d.id === today));

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4"><p className="font-jetbrains text-2xl text-on-surface" data-testid="fc-due-total">{due}</p><p className="text-xs uppercase tracking-widest text-on-surface-variant">To study now</p></div>
        <div className="glass-card p-4"><p className="font-jetbrains text-2xl text-on-surface">{stats.cards}</p><p className="text-xs uppercase tracking-widest text-on-surface-variant">Answered today</p></div>
        <div className="glass-card p-4"><p className="font-jetbrains text-2xl text-on-surface">{stats.cards ? `${stats.correctPct}%` : "—"}</p><p className="text-xs uppercase tracking-widest text-on-surface-variant">Correct today</p></div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {due > 0 && <Link href="/flashcards/review" data-testid="fc-study-all" className={primaryBtnCls}><span className="material-symbols-outlined text-[18px]">play_arrow</span>Study all ({due})</Link>}
        <button data-testid="deck-new" onClick={() => setCreating(true)} className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">add</span>New deck</button>
        <Link href="/flashcards/import" data-testid="fc-import" className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">upload_file</span>Import</Link>
        <Link href="/flashcards/stats" data-testid="fc-stats" className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">monitoring</span>Stats</Link>
      </div>

      {!loading && decks.length === 0 ? (
        <EmptyState icon="style" title="No decks yet" text={subjects.length === 0 ? "Add a subject first. Then make a deck for it, or import your Anki decks." : "Make a deck for a subject, then add cards. Or import an Anki .apkg or a CSV file."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {decks.map((d) => {
            const q = buildQueue(cards, [d], logsToday, now, today);
            const total = totals[d.id] ?? 0;
            const subject = subjects.find((s) => s.id === d.subjectId);
            const c = getColor(subject?.color ?? "violet");
            const toStudy = q.counts.learning + q.counts.review + q.counts.new;
            return (
              <div key={d.id} data-testid="deck-item" className="glass-card p-4 flex flex-col gap-3">
                <Link href={`/flashcards/deck?id=${d.id}`} className="flex items-center gap-3 min-w-0 group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                    <span className="material-symbols-outlined" style={{ color: c.text }}>style</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-grotesk font-bold text-on-surface truncate group-hover:text-primary">{d.name}</p>
                    <p className="text-xs text-on-surface-variant">{subject?.name ?? "No subject"} · {total} card{total === 1 ? "" : "s"}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-3 text-xs font-jetbrains" data-testid="deck-counts">
                  <span className="text-error" title="Learning">{q.counts.learning} learn</span>
                  <span className="text-secondary" title="Reviews due">{q.counts.review} due</span>
                  <span className="text-primary" title="New today">{q.counts.new} new</span>
                  {toStudy > 0 ? (
                    <Link href={`/flashcards/review?deck=${d.id}`} data-testid="deck-study" className="ml-auto px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container font-inter font-bold">Study</Link>
                  ) : (
                    <span className="ml-auto text-on-surface-variant font-inter">{q.laterToday.length ? "More later today" : "Done for today ✓"}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {creating && <DeckModal uid={uid} subjects={subjects} onClose={() => setCreating(false)} />}
    </div>
  );
}
