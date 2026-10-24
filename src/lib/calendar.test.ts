import { buildEvents, weekDates, monthGrid, layoutDay, hourRange, blockDone, minutesToHHMM, type CalEvent } from "./calendar";
import type { CalendarData } from "./calendar";

const empty: CalendarData = { classes: [], timetable: { rotationWeeks: 1, holidays: [] }, exams: [], tasks: [], blocks: [], sessions: [] };

describe("ranges", () => {
  it("week starts Monday", () => {
    expect(weekDates("2026-10-23")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
  });
  it("month grid has 42 days starting on the Monday before the 1st", () => {
    const g = monthGrid("2026-10-23");
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-09-28");
    expect(g).toContain("2026-10-31");
  });
});

describe("buildEvents", () => {
  const data: CalendarData = {
    ...empty,
    classes: [{ id: "c", subjectId: "s", room: "1", createdAt: 0, slots: [{ weekday: 1, start: "09:00", end: "10:00" }] }],
    exams: [{ id: "e", subjectId: "s", title: "Final", date: "2026-10-21", startTime: "14:00", durationMinutes: 90, createdAt: 0 }],
    tasks: [
      { id: "t1", uid: "u", title: "Essay", completed: false, dueDate: "2026-10-22", createdAt: "" },
      { id: "t2", uid: "u", title: "Quiz prep", completed: true, dueDate: "2026-10-22", dueTime: "18:00", createdAt: "" },
      { id: "t3", uid: "u", title: "No date", completed: false, createdAt: "" },
    ],
    blocks: [{ id: "b", title: "Revise", date: "2026-10-20", start: "16:00", end: "17:00", minutesDone: 60, createdAt: 0 }],
    sessions: [{ id: "x", uid: "u", subjectId: "s", subjectName: "Bio", subjectColor: "violet", durationMinutes: 25, focusScore: 90, pomodoroCount: 1, date: "2026-10-23", startTime: "08:00", endTime: "08:25" }],
  };
  const ev = buildEvents(data, "2026-10-19", "2026-10-25");
  it("includes every kind, in date/time order", () => {
    expect(ev.map((e) => `${e.kind}:${e.date}:${e.start ?? "all-day"}`)).toEqual([
      "class:2026-10-19:09:00", "block:2026-10-20:16:00", "exam:2026-10-21:14:00",
      "task:2026-10-22:all-day", "task:2026-10-22:18:00", "session:2026-10-23:08:00",
    ]);
  });
  it("computes exam end from its length and block done from minutes", () => {
    expect(ev.find((e) => e.kind === "exam")!.end).toBe("15:30");
    expect(ev.find((e) => e.kind === "block")!.done).toBe(true);
    expect(ev.find((e) => e.refId === "t2")!.done).toBe(true);
  });
  it("ends a session with end not after start at start + length, max 23:59", () => {
    const s = data.sessions[0];
    const endOf = (startTime: string, endTime: string) =>
      buildEvents({ ...empty, sessions: [{ ...s, startTime, endTime }] }, "2026-10-23", "2026-10-23")[0].end;
    expect(endOf("08:58", "08:58")).toBe("09:23");
    expect(endOf("23:50", "00:15")).toBe("23:59");
  });
  it("leaves out items outside the range", () => {
    expect(buildEvents(data, "2026-10-26", "2026-10-26").map((e) => e.kind)).toEqual(["class"]);
  });
});

describe("layoutDay", () => {
  const e = (key: string, start: string, end: string): CalEvent => ({ key, kind: "block", title: key, date: "d", start, end });
  it("puts overlapping events side by side", () => {
    const placed = layoutDay([e("a", "09:00", "10:00"), e("b", "09:30", "10:30"), e("c", "11:00", "12:00")]);
    const by = Object.fromEntries(placed.map((p) => [p.event.key, p]));
    expect([by.a.column, by.a.columns]).toEqual([0, 2]);
    expect([by.b.column, by.b.columns]).toEqual([1, 2]);
    expect([by.c.column, by.c.columns]).toEqual([0, 1]);
  });
  it("reuses a free column", () => {
    const placed = layoutDay([e("a", "09:00", "12:00"), e("b", "09:00", "10:00"), e("c", "10:00", "11:00")]);
    const by = Object.fromEntries(placed.map((p) => [p.event.key, p]));
    expect(by.c.column).toBe(1);
    expect(by.a.columns).toBe(2);
  });
});

describe("helpers", () => {
  it("hour range grows for early/late events", () => {
    expect(hourRange([])).toEqual([7, 22]);
    expect(hourRange([{ key: "x", kind: "class", title: "", date: "", start: "06:30", end: "23:15" }])).toEqual([6, 24]);
  });
  it("blockDone and minutesToHHMM", () => {
    expect(blockDone({ id: "b", title: "", date: "", start: "10:00", end: "11:00", minutesDone: 30, createdAt: 0 })).toBe(false);
    expect(blockDone({ id: "b", title: "", date: "", start: "10:00", end: "11:00", done: true, createdAt: 0 })).toBe(true);
    expect(minutesToHHMM(90)).toBe("01:30");
    expect(minutesToHHMM(2000)).toBe("23:59");
  });
});
