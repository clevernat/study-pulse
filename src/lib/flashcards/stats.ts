import type { Card, ReviewLogDoc } from "@/types";

export interface TodayStats { cards: number; minutes: number; againPct: number; correctPct: number }

export function todayStats(logs: Pick<ReviewLogDoc, "rating" | "durationMs">[]): TodayStats {
  const n = logs.length;
  const again = logs.filter((l) => l.rating === 1).length;
  return {
    cards: n,
    minutes: Math.round(logs.reduce((s, l) => s + l.durationMs, 0) / 60_000),
    againPct: n ? Math.round((again / n) * 100) : 0,
    correctPct: n ? Math.round(((n - again) / n) * 100) : 0,
  };
}

/** Review cards due on each of the next `days` days (index 0 = today, overdue included). */
export function forecast(cards: Card[], dayStarts: number[]): number[] {
  const counts = dayStarts.map(() => 0);
  for (const c of cards) {
    if (c.state === 0 || c.suspended) continue;
    let i = dayStarts.findIndex((start, j) => c.due < (dayStarts[j + 1] ?? start + 86_400_000));
    if (i === -1) continue;
    if (c.due < dayStarts[0]) i = 0;
    counts[i]++;
  }
  return counts;
}

export interface CardCounts { new: number; learning: number; young: number; mature: number; suspended: number }

/** Mature = interval of 21 days or more. */
export function cardCounts(cards: Card[]): CardCounts {
  const out: CardCounts = { new: 0, learning: 0, young: 0, mature: 0, suspended: 0 };
  for (const c of cards) {
    if (c.suspended) out.suspended++;
    else if (c.state === 0) out.new++;
    else if (c.state === 1 || c.state === 3) out.learning++;
    else if (c.scheduled_days >= 21) out.mature++;
    else out.young++;
  }
  return out;
}

/**
 * True retention: of the review-state cards answered (first answer per card
 * per day), how many were remembered (anything but Again).
 */
export function trueRetention(logs: Pick<ReviewLogDoc, "cardId" | "rating" | "state" | "review">[], dayKey: (ms: number) => string): { pass: number; total: number; pct: number } {
  const seen = new Set<string>();
  let pass = 0, total = 0;
  for (const l of [...logs].sort((a, b) => a.review - b.review)) {
    if (l.state !== 2) continue;
    const key = `${l.cardId}|${dayKey(l.review)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    total++;
    if (l.rating !== 1) pass++;
  }
  return { pass, total, pct: total ? Math.round((pass / total) * 100) : 0 };
}

/** Number of answers per day, for the review heat map. */
export function reviewsPerDay(logs: Pick<ReviewLogDoc, "review">[], dayKey: (ms: number) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of logs) { const d = dayKey(l.review); out[d] = (out[d] ?? 0) + 1; }
  return out;
}
