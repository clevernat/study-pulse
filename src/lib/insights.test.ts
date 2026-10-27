import {
  targetProgress, minutesByTopic, averageRating, focusTrend, distractionsPerHour,
  weeklyReview, resultsWithEffort, effortCorrelation, effortVerdict, subjectTargets, targetProgress as tp,
} from "./insights";
import type { Session, Subject, TestResult } from "@/types";

// 2026-10-21 is a Wednesday; its week runs Mon 10-19 … Sun 10-25.
const TODAY = "2026-10-21";

const ses = (date: string, minutes: number, extra: Partial<Session> = {}): Session => ({
  id: `${date}-${minutes}-${Math.random()}`, uid: "u", subjectId: "math", subjectName: "Math", subjectColor: "violet",
  durationMinutes: minutes, focusScore: 100, pomodoroCount: 1, date, startTime: "09:00", endTime: "09:25", ...extra,
});
const subject = (id: string, name: string): Subject => ({ id, uid: "u", name, icon: "school", color: "violet", category: "STEM", totalMinutes: 0, sessionCount: 0, createdAt: "" });

describe("targetProgress", () => {
  const sessions = [ses("2026-10-19", 60), ses("2026-10-20", 60), ses("2026-10-21", 30), ses("2026-10-18", 600)];
  it("counts today and this Monday–Sunday week only", () => {
    const p = targetProgress(sessions, TODAY);
    expect(p.todayMinutes).toBe(30);
    expect(p.weekMinutes).toBe(150);
    expect(p.weekStart).toBe("2026-10-19");
    expect(p.daily).toBeUndefined();
  });
  it("daily target: percent and minutes left", () => {
    expect(targetProgress(sessions, TODAY, 120).daily).toEqual({ target: 120, pct: 25, left: 90 });
  });
  it("weekly target: on track compares with an even spread over the week", () => {
    // 7 h a week = 60 min a day; Wednesday is day 3 → 180 min expected, 150 done.
    const w = targetProgress(sessions, TODAY, undefined, 420).weekly!;
    expect(w.expectedByToday).toBe(180);
    expect(w.onTrack).toBe(false);
    expect(targetProgress([...sessions, ses(TODAY, 30)], TODAY, undefined, 420).weekly!.onTrack).toBe(true);
  });
});

describe("minutesByTopic", () => {
  it("adds minutes per topic of one subject; no topic under ''", () => {
    const list = [ses(TODAY, 30, { topicId: "lim" }), ses(TODAY, 20, { topicId: "lim" }), ses(TODAY, 10), ses(TODAY, 99, { subjectId: "bio", topicId: "lim" })];
    expect(minutesByTopic(list, "math")).toEqual({ lim: 50, "": 10 });
  });
});

describe("focus ratings", () => {
  it("averages rated sessions weighted by minutes and ignores unrated ones", () => {
    expect(averageRating([ses(TODAY, 50, { focusRating: 4 }), ses(TODAY, 25, { focusRating: 1 }), ses(TODAY, 100)])).toBe(3);
    expect(averageRating([ses(TODAY, 50)])).toBeNull();
  });
  it("weekly trend, oldest first", () => {
    const t = focusTrend([ses("2026-10-13", 30, { focusRating: 2 }), ses(TODAY, 30, { focusRating: 5 })], TODAY, 3);
    expect(t.map((w) => [w.weekStart, w.rating, w.rated])).toEqual([["2026-10-05", null, 0], ["2026-10-12", 2, 1], ["2026-10-19", 5, 1]]);
  });
  it("distractions per hour", () => {
    expect(distractionsPerHour([ses(TODAY, 30, { distractions: 2 }), ses(TODAY, 30, { distractions: 1 })])).toBe(3);
    expect(distractionsPerHour([])).toBeNull();
  });
});

describe("weeklyReview", () => {
  const subjects = [subject("math", "Math"), subject("bio", "Biology"), subject("art", "Art")];
  const sessions = [
    // Weeks before: Biology usually 120 min a week, Math 60.
    ...["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"].map((d) => ses(d, 120, { subjectId: "bio", subjectName: "Biology", startTime: "20:00" })),
    ...["2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"].map((d) => ses(d, 60, { startTime: "08:00", focusRating: 5 })),
    // This week: only Math.
    ses("2026-10-19", 90, { topicId: "lim", topicTitle: "Limits", focusRating: 4, distractions: 3 }),
    ses("2026-10-21", 30, { topicId: "int", topicTitle: "Integrals", focusRating: 2 }),
  ];
  const r = weeklyReview(sessions, subjects, "2026-10-19", TODAY);

  it("hours this week vs last week", () => {
    expect(r.thisWeek).toBe(120);
    expect(r.lastWeek).toBe(180);
    expect(r.changePct).toBe(-33);
    expect(r.perDay).toEqual([90, 0, 30, 0, 0, 0, 0]);
  });
  it("neglected subject = biggest drop from the usual week (not a never-studied one)", () => {
    expect(r.neglected?.name).toBe("Biology");
    expect(r.neglected?.usualWeek).toBe(120);
    expect(r.subjects.find((s) => s.subjectId === "art")?.usualWeek).toBe(0);
  });
  it("best study time prefers the best-rated part of the day", () => {
    expect(r.bestTime?.part).toBe("Morning (5–12)");
    expect(r.bestTime?.weekday).toBe("Monday");
  });
  it("streak, ratings, distractions, top topics", () => {
    expect(r.streak).toBe(1);
    expect(r.rating).toBe(3.5);
    expect(r.lastWeekRating).toBe(5);
    expect(r.distractionsPerHour).toBe(1.5);
    expect(r.topTopics.map((t) => [t.title, t.minutes])).toEqual([["Limits", 90], ["Integrals", 30]]);
  });
  it("empty week", () => {
    const e = weeklyReview([], subjects, "2026-10-19", TODAY);
    expect([e.thisWeek, e.changePct, e.neglected, e.bestTime, e.rating]).toEqual([0, null, null, null, null]);
  });
});

describe("results vs effort", () => {
  const res = (date: string, score: number, max = 100): TestResult => ({ id: date, subjectId: "math", title: "Quiz", date, score, maxScore: max, createdAt: 0 });
  const sessions = [ses("2026-10-01", 60), ses("2026-10-10", 120), ses("2026-10-12", 120), ses("2026-09-01", 500)];
  it("minutes in the 14 days up to the test", () => {
    const pts = resultsWithEffort([res("2026-10-12", 9, 10), res("2026-10-02", 40)], sessions, "math");
    expect(pts.map((p) => [p.result.date, p.pct, p.minutesBefore])).toEqual([["2026-10-02", 40, 60], ["2026-10-12", 90, 300]]);
  });
  it("correlation and verdict", () => {
    const pts = resultsWithEffort([res("2026-10-02", 40), res("2026-10-12", 90), res("2026-10-11", 70)], sessions, "math");
    const r = effortCorrelation(pts)!;
    expect(r).toBeGreaterThan(0.5);
    expect(effortVerdict(r, 3)).toMatch(/Clear link/);
    expect(effortCorrelation(pts.slice(0, 2))).toBeNull();
    expect(effortVerdict(null, 1)).toMatch(/Add 2 more results/);
  });
});

describe("subjectTargets", () => {
  it("counts only that subject's sessions, and skips subjects without a target", () => {
    const math = { ...subject("math", "Math"), weeklyTargetMinutes: 300 };
    const bio = { ...subject("bio", "Biology"), dailyTargetMinutes: 60 };
    const sessions = [ses("2026-10-21", 30), ses("2026-10-20", 90), ses("2026-10-21", 45, { subjectId: "bio" })];
    const t = subjectTargets(sessions, [math, bio, subject("art", "Art")], TODAY);
    expect(t.map((x) => x.subject.name)).toEqual(["Biology", "Math"]);
    expect(t[0].daily).toEqual({ target: 60, pct: 75, left: 15 });
    expect(t[1].weekMinutes).toBe(120);
    expect(t[1].weekly?.pct).toBe(40);
  });
});

describe("a target set during the week", () => {
  it("is not called behind in its first week, and is judged normally after", () => {
    // TODAY is Wednesday 2026-10-21; the week started Monday 2026-10-19.
    expect(tp([], TODAY, undefined, 600, "2026-10-21").weekly).toMatchObject({ onTrack: false, newThisWeek: true });
    expect(tp([], TODAY, undefined, 600, "2026-10-19").weekly?.newThisWeek).toBe(false);
    expect(tp([], TODAY, undefined, 600).weekly?.newThisWeek).toBe(false);
  });
});
