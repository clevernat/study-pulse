import { alignedDays, buildProgress, signals } from "./progress";
import type { Exam, Goal, Session, Subject, TestResult, Topic } from "@/types";

const TODAY = "2026-10-21"; // Wednesday
const NOW = Date.parse("2026-10-21T20:00:00Z");
const ses = (date: string, minutes: number, extra: Partial<Session> = {}): Session => ({
  id: Math.random().toString(), uid: "u", subjectId: "math", subjectName: "Math", subjectColor: "violet",
  durationMinutes: minutes, focusScore: 100, pomodoroCount: 1, date, startTime: "19:00", endTime: "19:25", ...extra,
});
const subject = (id: string, name: string): Subject => ({ id, uid: "u", name, icon: "school", color: "violet", category: "STEM", totalMinutes: 0, sessionCount: 0, createdAt: "" });

const input = {
  name: "Ama", email: "ama@x.test",
  sessions: [
    ses("2026-10-19", 60, { focusRating: 5 }), ses("2026-10-20", 60, { focusRating: 4 }), ses("2026-10-21", 30, { subjectId: "bio" }),
    ses("2026-10-14", 30), ses("2026-09-01", 100),
  ],
  subjects: [subject("math", "Math"), subject("bio", "Biology")],
  goals: [
    { id: "g1", uid: "u", title: "Math 2h", type: "weekly", targetHours: 2, currentHours: 0, subjectId: "math", deadline: "2026-10-25", completed: false, createdAt: "2026-10-19" },
    { id: "g2", uid: "u", title: "Bio 10h", type: "weekly", targetHours: 10, currentHours: 0, subjectId: "bio", deadline: "2026-10-25", completed: false, createdAt: "2026-10-19" },
  ] as Goal[],
  exams: [{ id: "e1", subjectId: "math", title: "Final", date: "2026-11-02" }, { id: "e0", subjectId: "math", title: "Old", date: "2026-10-01" }] as Exam[],
  results: [{ id: "r", subjectId: "math", title: "Q", date: TODAY, score: 8, maxScore: 10, createdAt: 0 }] as TestResult[],
  topics: [{ done: true }, { done: true }, { done: false }] as Topic[],
  target: { daily: 60, weekly: 300 },
};

describe("buildProgress", () => {
  const p = buildProgress(input, TODAY, NOW);
  it("sums time: total, this week, last week, 14 days ending today", () => {
    expect(p.totalMinutes).toBe(280);
    expect(p.thisWeek).toBe(150);
    expect(p.lastWeek).toBe(30);
    expect(p.days).toHaveLength(14);
    expect(p.days.slice(-3)).toEqual([60, 60, 30]);
    expect(p.days[13 - 7]).toBe(30); // 2026-10-14
  });
  it("streak, focus, subjects, goals, exam, scores, topics", () => {
    expect(p.streak).toBe(3);
    expect(p.rating).toBe(4.5);
    expect(p.subjects.map((s) => [s.name, s.minutes, s.weekMinutes])).toEqual([["Math", 250, 120], ["Biology", 30, 30]]);
    expect(p.goals).toEqual({ active: 1, done: 1 });
    expect(p.nextExam).toEqual({ title: "Final", date: "2026-11-02" });
    expect(p.results).toEqual({ count: 1, avgPct: 80 });
    expect(p.topics).toEqual({ done: 2, total: 3 });
    expect(p.bestTime?.part).toBeTruthy();
  });
});

describe("signals", () => {
  it("names what someone does well", () => {
    const texts = signals(buildProgress(input, TODAY, NOW), NOW).filter((s) => s.kind === "good").map((s) => s.text);
    expect(texts).toEqual(["3-day streak", "Up 400% on last week", "Strong focus (4.5/5)", "Scores average 80%", "Covered 67% of topics", "1 goal reached"]);
  });
  it("flags someone who stopped studying or opening the app", () => {
    const quiet = buildProgress({ ...input, sessions: [ses("2026-10-01", 60)] }, TODAY, NOW);
    expect(signals(quiet, NOW).filter((s) => s.kind === "watch").map((s) => s.text)).toContain("No study in the last 7 days");
    expect(signals(quiet, NOW + 9 * 86_400_000).map((s) => s.text)).toContain("Has not opened StudyPulse for 9 days");
  });
});

describe("alignedDays", () => {
  it("shifts an older summary so the last day is today", () => {
    const days = Array.from({ length: 14 }, (_, i) => i + 1); // 1..14, 14 = 2026-10-18
    expect(alignedDays({ days, today: "2026-10-18" }, TODAY).slice(-5)).toEqual([13, 14, 0, 0, 0]);
    expect(alignedDays({ days, today: TODAY }, TODAY)).toEqual(days);
  });
});
