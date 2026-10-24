import { localDateStr, daysAgoStr } from "./dateUtils";

describe("localDateStr", () => {
  it("uses the local calendar day, not UTC", () => {
    const lateEvening = new Date(2026, 9, 23, 23, 30); // Oct 23, 23:30 local
    expect(localDateStr(lateEvening)).toBe("2026-10-23");
  });
});

describe("daysAgoStr", () => {
  it("gives the first day of a 7-day window ending today", () => {
    expect(daysAgoStr(6, new Date(2026, 9, 23, 12))).toBe("2026-10-17");
  });
  it("crosses month and year boundaries", () => {
    expect(daysAgoStr(1, new Date(2026, 0, 1, 8))).toBe("2025-12-31");
  });
});
