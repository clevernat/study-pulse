import { computeStreak, hasPerfectWeek, computeLongestStreak } from "./streakLogic";

describe("computeStreak", () => {
  it("returns 0 for empty dates", () => {
    expect(computeStreak([], "2024-10-24")).toBe(0);
  });
  it("returns 1 for single date matching today", () => {
    expect(computeStreak(["2024-10-24"], "2024-10-24")).toBe(1);
  });
  it("counts consecutive days correctly", () => {
    const dates = ["2024-10-22", "2024-10-23", "2024-10-24"];
    expect(computeStreak(dates, "2024-10-24")).toBe(3);
  });
  it("breaks streak on gap", () => {
    const dates = ["2024-10-20", "2024-10-22", "2024-10-23", "2024-10-24"];
    expect(computeStreak(dates, "2024-10-24")).toBe(3);
  });
  it("handles duplicates correctly", () => {
    const dates = ["2024-10-24", "2024-10-24", "2024-10-23"];
    expect(computeStreak(dates, "2024-10-24")).toBe(2);
  });
});

describe("computeLongestStreak", () => {
  it("returns 0 for empty array", () => {
    expect(computeLongestStreak([])).toBe(0);
  });
  it("finds longest run in fragmented data", () => {
    const dates = ["2024-10-01", "2024-10-02", "2024-10-03", "2024-10-10", "2024-10-11"];
    expect(computeLongestStreak(dates)).toBe(3);
  });
  it("handles single date", () => {
    expect(computeLongestStreak(["2024-10-01"])).toBe(1);
  });
});

describe("hasPerfectWeek", () => {
  it("returns true for 7 consecutive days", () => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date("2024-10-24");
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    expect(hasPerfectWeek(dates, "2024-10-24")).toBe(true);
  });
  it("returns false for streak < 7", () => {
    const dates = ["2024-10-23", "2024-10-24"];
    expect(hasPerfectWeek(dates, "2024-10-24")).toBe(false);
  });
});
