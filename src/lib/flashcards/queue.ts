import type { Card, Deck, ReviewLogDoc } from "@/types";

export const LEARN_AHEAD_MS = 20 * 60_000;

/** Start (local midnight) and end of the local day of `now`. */
export function dayBounds(now: Date): { start: number; end: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return { start, end };
}

export interface QueueCounts { learning: number; review: number; new: number }

export interface Queue {
  cards: Card[];
  counts: QueueCounts;
  /** Learning cards that come back later today (not shown yet) */
  laterToday: Card[];
}

/**
 * Cards to study now, in order: learning/relearning cards that are due
 * (failed cards first), then review cards due today (oldest first), then
 * new cards (oldest first). Daily limits count today's answers per deck.
 * Suspended and buried cards are left out. New cards whose note already had
 * a card studied today wait until tomorrow (sibling burying).
 * `learnAheadMs`: also show learning cards due that soon (use LEARN_AHEAD_MS
 * when nothing else is left, so the user does not wait for a few minutes).
 */
export function buildQueue(
  cards: Card[], decks: Deck[], logsToday: Pick<ReviewLogDoc, "cardId" | "noteId" | "deckId" | "state">[],
  now: Date, today: string, learnAheadMs = 0,
): Queue {
  const { end } = dayBounds(now);
  const nowMs = now.getTime();
  const deckById = new Map(decks.map((d) => [d.id, d]));
  const visible = cards.filter((c) => !c.suspended && !(c.buriedUntil && c.buriedUntil > today) && deckById.has(c.deckId));
  const touchedNotes = new Set(logsToday.map((l) => l.noteId));

  const learningAll = visible.filter((c) => c.state === 1 || c.state === 3);
  const learning = learningAll.filter((c) => c.due <= nowMs + learnAheadMs).sort((a, b) => a.due - b.due);
  const laterToday = learningAll.filter((c) => c.due > nowMs + learnAheadMs && c.due < end);

  const reviewOut: Card[] = [];
  const newOut: Card[] = [];
  for (const deck of decks) {
    const doneNew = logsToday.filter((l) => l.deckId === deck.id && l.state === 0).length;
    const doneReview = logsToday.filter((l) => l.deckId === deck.id && l.state === 2).length;
    const reviews = visible.filter((c) => c.deckId === deck.id && c.state === 2 && c.due < end).sort((a, b) => a.due - b.due);
    reviewOut.push(...reviews.slice(0, Math.max(0, deck.reviewsPerDay - doneReview)));
    const fresh = visible
      .filter((c) => c.deckId === deck.id && c.state === 0 && !touchedNotes.has(c.noteId))
      .sort((a, b) => a.createdAt - b.createdAt || a.ord - b.ord);
    // Only one new card per note per day.
    const seen = new Set<string>();
    const oneEach = fresh.filter((c) => (seen.has(c.noteId) ? false : (seen.add(c.noteId), true)));
    newOut.push(...oneEach.slice(0, Math.max(0, deck.newPerDay - doneNew)));
  }
  reviewOut.sort((a, b) => a.due - b.due);
  newOut.sort((a, b) => a.createdAt - b.createdAt || a.ord - b.ord);

  return {
    cards: [...learning, ...reviewOut, ...newOut],
    counts: { learning: learning.length, review: reviewOut.length, new: newOut.length },
    laterToday,
  };
}
