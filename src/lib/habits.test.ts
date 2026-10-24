import { currentStreak, bestStreak, periodProgress, doneOn, scheduleLabel, buildContext } from "./habits";
import type { Habit } from "@/types";

const habit = (over: Partial<Habit>): Habit =>
  ({ id: "h", title: "Read", icon: "book", color: "violet", schedule: { type: "daily" }, target: 1, log: {}, createdAt: 0, ...over });
const days = (...list: string[]) => Object.fromEntries(list.map((d) => [d, 1]));

describe("daily habits", () => {
  const h = habit({ log: days("2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-15", "2026-10-16") });
  it("counts days in a row ending today", () => {
    expect(currentStreak(h, "2026-10-23")).toBe(4);
  });
  it("keeps yesterday's streak while today is not done yet", () => {
    expect(currentStreak(h, "2026-10-24")).toBe(4);
  });
  it("breaks after a missed day", () => {
    expect(currentStreak(h, "2026-10-25")).toBe(0);
  });
  it("best streak", () => {
    expect(bestStreak(h, "2026-10-25")).toBe(4);
  });
  it("amount goals need the full amount", () => {
    const cards = habit({ target: 20, unit: "cards", log: { "2026-10-23": 19, "2026-10-22": 25 } });
    expect(doneOn(cards, "2026-10-23")).toBe(false);
    expect(doneOn(cards, "2026-10-22")).toBe(true);
    expect(periodProgress(cards, "2026-10-23")).toEqual({ done: 19, needed: 20 });
    expect(scheduleLabel(cards)).toBe("20 cards every day");
  });
});

describe("weekly habits (3× a week)", () => {
  // Weeks start Monday: 2026-10-05, 10-12, 10-19
  const h = habit({ schedule: { type: "weekly", timesPerWeek: 3 },
    log: days("2026-10-06", "2026-10-08", "2026-10-10", "2026-10-12", "2026-10-13", "2026-10-18", "2026-10-20") });
  it("counts full weeks in a row; this week still in progress", () => {
    expect(currentStreak(h, "2026-10-21")).toBe(2);
    expect(periodProgress(h, "2026-10-21")).toEqual({ done: 1, needed: 3 });
    expect(scheduleLabel(h)).toBe("3× a week");
  });
  it("this week counts once the goal is reached", () => {
    const more = { ...h, log: { ...h.log, ...days("2026-10-21", "2026-10-22") } };
    expect(currentStreak(more, "2026-10-22")).toBe(3);
    expect(bestStreak(more, "2026-10-22")).toBe(3);
  });
  it("a missed week breaks the streak", () => {
    expect(currentStreak(h, "2026-11-04")).toBe(0);
  });
});

describe("automatic habits", () => {
  it("use study minutes or reviewed cards from app data", () => {
    const ctx = buildContext(
      [{ date: "2026-10-23", durationMinutes: 40 }, { date: "2026-10-23", durationMinutes: 25 }],
      [{ review: 1 }, { review: 2 }],
      () => "2026-10-23");
    const study = habit({ target: 60, autoSource: "studyMinutes" });
    const cards = habit({ target: 3, autoSource: "cardsReviewed" });
    expect(doneOn(study, "2026-10-23", ctx)).toBe(true);
    expect(doneOn(cards, "2026-10-23", ctx)).toBe(false);
    expect(currentStreak(study, "2026-10-23", ctx)).toBe(1);
  });
});
