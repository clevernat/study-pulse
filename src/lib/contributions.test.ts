import { contributionWeeks, level, monthLabels } from "./contributions";

const TODAY = "2026-10-21"; // a Wednesday

describe("contribution graph", () => {
  it("shades by fixed steps of study time", () => {
    expect([0, 10, 45, 90, 200].map(level)).toEqual([0, 1, 2, 3, 4]);
  });
  it("53 weeks of 7 days, Sunday first, ending this week; future days empty", () => {
    const minutes: Record<string, number> = { "2026-10-21": 50, "2026-10-19": 130 };
    const weeks = contributionWeeks((d) => minutes[d] ?? 0, TODAY);
    expect(weeks).toHaveLength(53);
    const last = weeks[52];
    expect(last[0]?.date).toBe("2026-10-18"); // Sunday
    expect(last[1]).toMatchObject({ date: "2026-10-19", minutes: 130, level: 4 });
    expect(last[3]).toMatchObject({ date: TODAY, level: 2 });
    expect(last[4]).toBeNull();
    expect(weeks[0][0]?.date).toBe("2025-10-19");
  });
  it("labels the week where each month starts", () => {
    const labels = monthLabels(contributionWeeks(() => 0, TODAY)).filter(Boolean);
    expect(labels.length).toBeGreaterThanOrEqual(11);
    expect(labels[labels.length - 1]).toBe("Oct");
  });
});
