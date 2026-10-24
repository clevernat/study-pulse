import { dayDelta, negate, dayTotals, retentionSince } from "./reviewDays";

describe("review day summary", () => {
  it("counts answers, time, Again and first-of-day retention on review cards", () => {
    expect(dayDelta({ id: "a", state: 2 }, 3, 5000, [])).toEqual({ count: 1, ms: 5000, again: 0, retPass: 1, retTotal: 1 });
    expect(dayDelta({ id: "a", state: 2 }, 1, 4000, [])).toEqual({ count: 1, ms: 4000, again: 1, retPass: 0, retTotal: 1 });
    // second answer today on the same card, and new/learning cards: not in retention
    expect(dayDelta({ id: "a", state: 2 }, 3, 1000, [{ cardId: "a" }]).retTotal).toBe(0);
    expect(dayDelta({ id: "b", state: 0 }, 3, 1000, []).retTotal).toBe(0);
    expect(dayDelta({ id: "c", state: 1 }, 1, 1000, []).again).toBe(1);
  });
  it("undo subtracts exactly", () => {
    const d = dayDelta({ id: "a", state: 2 }, 1, 4000, []);
    expect(negate(d)).toEqual({ count: -1, ms: -4000, again: -1, retPass: -0, retTotal: -1 });
  });
  it("totals and retention over days", () => {
    expect(dayTotals({ count: 4, ms: 125_000, again: 1 })).toEqual({ cards: 4, minutes: 2, againPct: 25, correctPct: 75 });
    expect(dayTotals(undefined)).toEqual({ cards: 0, minutes: 0, againPct: 0, correctPct: 0 });
    const days = [
      { id: "2026-09-01", count: 9, ms: 0, again: 0, retPass: 9, retTotal: 9 },
      { id: "2026-10-20", count: 5, ms: 0, again: 1, retPass: 3, retTotal: 4 },
      { id: "2026-10-23", count: 2, ms: 0, again: 0, retPass: 1, retTotal: 1 },
    ];
    expect(retentionSince(days, "2026-10-01")).toEqual({ pass: 4, total: 5, pct: 80 });
  });
});
