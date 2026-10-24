import type { Card, ReviewDay, ReviewLogDoc } from "@/types";

export type DayDelta = Omit<ReviewDay, "id">;

/**
 * What one answer adds to today's summary. "Retention" counts only the first
 * answer of the day on a card that was in review (Again = forgotten).
 */
export function dayDelta(card: Pick<Card, "id" | "state">, rating: number, durationMs: number, logsToday: Pick<ReviewLogDoc, "cardId">[]): DayDelta {
  const firstToday = !logsToday.some((l) => l.cardId === card.id);
  const counts = card.state === 2 && firstToday;
  return { count: 1, ms: durationMs, again: rating === 1 ? 1 : 0, retPass: counts && rating !== 1 ? 1 : 0, retTotal: counts ? 1 : 0 };
}

export function negate(d: DayDelta): DayDelta {
  return { count: -d.count, ms: -d.ms, again: -d.again, retPass: -d.retPass, retTotal: -d.retTotal };
}

export interface DayTotals { cards: number; minutes: number; againPct: number; correctPct: number }

export function dayTotals(day?: Partial<ReviewDay>): DayTotals {
  const n = day?.count ?? 0;
  const again = day?.again ?? 0;
  return {
    cards: n,
    minutes: Math.round((day?.ms ?? 0) / 60_000),
    againPct: n ? Math.round((again / n) * 100) : 0,
    correctPct: n ? Math.round(((n - again) / n) * 100) : 0,
  };
}

/** Remembered % over the days from `from` (inclusive, "YYYY-MM-DD"). */
export function retentionSince(days: ReviewDay[], from: string): { pass: number; total: number; pct: number } {
  let pass = 0, total = 0;
  for (const d of days) if (d.id >= from) { pass += d.retPass ?? 0; total += d.retTotal ?? 0; }
  return { pass, total, pct: total ? Math.round((pass / total) * 100) : 0 };
}
