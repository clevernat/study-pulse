import { daysUntil, urgency, countdownLabel, upcomingExams, topicProgress, examProgress } from "./exams";
import type { Exam, Topic, Task } from "@/types";

const exam = (id: string, date: string, startTime?: string): Exam =>
  ({ id, subjectId: "s1", title: id, date, startTime, createdAt: 0 });

describe("daysUntil", () => {
  it("counts whole days", () => {
    expect(daysUntil("2026-10-30", "2026-10-23")).toBe(7);
    expect(daysUntil("2026-10-23", "2026-10-23")).toBe(0);
    expect(daysUntil("2026-10-22", "2026-10-23")).toBe(-1);
  });
  it("is not affected by daylight saving changes", () => {
    expect(daysUntil("2026-11-02", "2026-10-31")).toBe(2); // US clocks change Nov 1
    expect(daysUntil("2027-03-15", "2027-03-13")).toBe(2);
  });
  it("crosses years", () => {
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
  });
});

describe("urgency and label", () => {
  it.each([[-3, "past"], [0, "today"], [1, "red"], [6, "red"], [7, "amber"], [14, "amber"], [15, "green"]])(
    "%i days → %s", (d, u) => expect(urgency(d as number)).toBe(u));
  it("labels", () => {
    expect(countdownLabel(0)).toBe("Today");
    expect(countdownLabel(1)).toBe("Tomorrow");
    expect(countdownLabel(12)).toBe("12 days left");
    expect(countdownLabel(-1)).toBe("Yesterday");
    expect(countdownLabel(-4)).toBe("4 days ago");
  });
});

describe("upcomingExams", () => {
  it("drops past exams and sorts by date then time", () => {
    const list = [exam("c", "2026-11-02"), exam("past", "2026-10-01"), exam("b", "2026-10-25", "14:00"), exam("a", "2026-10-25", "09:00")];
    expect(upcomingExams(list, "2026-10-23").map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(upcomingExams(list, "2026-10-23", 2).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("progress", () => {
  const topics: Topic[] = [
    { id: "1", subjectId: "s1", title: "a", done: true, order: 0, examId: "e1", createdAt: 0 },
    { id: "2", subjectId: "s1", title: "b", done: false, order: 1, examId: "e1", createdAt: 0 },
    { id: "3", subjectId: "s1", title: "c", done: true, order: 2, createdAt: 0 },
    { id: "4", subjectId: "s2", title: "d", done: false, order: 0, createdAt: 0 },
  ];
  const tasks = [
    { id: "t1", uid: "u", title: "rev", completed: true, kind: "revision", examId: "e1", createdAt: "" },
    { id: "t2", uid: "u", title: "other", completed: true, createdAt: "" },
  ] as Task[];
  it("topic progress per subject", () => {
    expect(topicProgress(topics, "s1")).toEqual({ done: 2, total: 3, pct: 67 });
    expect(topicProgress(topics, "none")).toEqual({ done: 0, total: 0, pct: 0 });
  });
  it("exam progress counts linked topics and tasks", () => {
    expect(examProgress("e1", topics, tasks)).toEqual({ done: 2, total: 3, pct: 67 });
  });
});
