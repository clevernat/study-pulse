import type { Card } from "@/types";

/** Review cards due on each of the next days (index 0 = today, overdue included). New and suspended cards are left out. */
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
