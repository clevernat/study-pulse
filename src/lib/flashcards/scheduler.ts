import { fsrs, createEmptyCard, Rating, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { Card, Deck, ReviewLogDoc } from "@/types";

export { Rating };
export type Answer = Grade; // Again=1, Hard=2, Good=3, Easy=4
export const ANSWERS: { rating: Answer; label: string; key: string }[] = [
  { rating: Rating.Again, label: "Again", key: "1" },
  { rating: Rating.Hard, label: "Hard", key: "2" },
  { rating: Rating.Good, label: "Good", key: "3" },
  { rating: Rating.Easy, label: "Easy", key: "4" },
];

/** A card is suspended automatically after this many lapses (forgotten reviews). */
export const LEECH_LAPSES = 8;

export type SchedFields = Pick<Card, "due" | "stability" | "difficulty" | "scheduled_days" | "learning_steps" | "reps" | "lapses" | "state" | "last_review">;

// One scheduler per retention value. Defaults match common spaced-repetition
// settings: learning steps 1m 10m, relearning 10m, max interval 100 years.
const schedulers = new Map<number, ReturnType<typeof fsrs>>();
function scheduler(retention = 0.9) {
  let s = schedulers.get(retention);
  if (!s) { s = fsrs({ request_retention: retention, enable_fuzz: true }); schedulers.set(retention, s); }
  return s;
}

function toFsrs(c: SchedFields): FsrsCard {
  return {
    due: new Date(c.due), stability: c.stability, difficulty: c.difficulty, elapsed_days: 0,
    scheduled_days: c.scheduled_days, learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses,
    state: c.state, last_review: c.last_review == null ? undefined : new Date(c.last_review),
  };
}

function fromFsrs(c: FsrsCard): SchedFields {
  return {
    due: c.due.getTime(), stability: c.stability, difficulty: c.difficulty, scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses, state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : null,
  };
}

/** Scheduling fields for a brand-new card (due now). */
export function newCardFields(now = new Date()): SchedFields {
  return fromFsrs(createEmptyCard(now));
}

/** The result of answering a card: its new fields and the review log entry. */
export function answerCard(card: Card, rating: Answer, now: Date, deck?: Pick<Deck, "retention">, durationMs = 0):
  { fields: SchedFields & { suspended?: boolean }; log: Omit<ReviewLogDoc, "id"> } {
  const { card: next, log } = scheduler(deck?.retention).next(toFsrs(card), now, rating);
  const fields: SchedFields & { suspended?: boolean } = fromFsrs(next);
  if (rating === Rating.Again && card.state === 2 && next.lapses >= LEECH_LAPSES) fields.suspended = true;
  return {
    fields,
    log: {
      cardId: card.id, noteId: card.noteId, deckId: card.deckId, rating, state: log.state,
      due: log.due.getTime(), stability: log.stability, difficulty: log.difficulty,
      scheduled_days: log.scheduled_days, review: now.getTime(), durationMs: Math.min(durationMs, 10 * 60_000),
    },
  };
}

/** Next interval for each of the 4 answers, as short text ("10m", "1d", "3.5mo"). */
export function previewIntervals(card: Card, now: Date, deck?: Pick<Deck, "retention">): Record<Answer, string> {
  const preview = scheduler(deck?.retention).repeat(toFsrs(card), now);
  const out = {} as Record<Answer, string>;
  for (const a of ANSWERS) out[a.rating] = formatInterval(preview[a.rating].card.due.getTime() - now.getTime());
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}m`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${(d / 30).toFixed(1).replace(/\.0$/, "")}mo`;
  return `${(d / 365).toFixed(1).replace(/\.0$/, "")}y`;
}

/** Chance (0–1) to remember the card now. New cards: 0. */
export function retrievability(card: Card, now = new Date(), deck?: Pick<Deck, "retention">): number {
  if (card.state === 0) return 0;
  return scheduler(deck?.retention).get_retrievability(toFsrs(card), now, false);
}
