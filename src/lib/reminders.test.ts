import { zonedToUtc, zonedDate } from "./zonedTime";
import { planReminders, diffReminders, type ReminderInput } from "./reminders";
import { buildIcs, escapeText, foldLine, feedEvents } from "./ics";

describe("zonedToUtc", () => {
  it("converts local time to UTC, also across daylight saving", () => {
    expect(new Date(zonedToUtc("2026-10-24", "09:00", "America/Denver")).toISOString()).toBe("2026-10-24T15:00:00.000Z"); // MDT -6
    expect(new Date(zonedToUtc("2026-11-02", "09:00", "America/Denver")).toISOString()).toBe("2026-11-02T16:00:00.000Z"); // MST -7
    expect(new Date(zonedToUtc("2026-07-01", "08:30", "Europe/London")).toISOString()).toBe("2026-07-01T07:30:00.000Z");
    expect(new Date(zonedToUtc("2026-03-08", "02:30", "America/New_York")).getTime()).toBeGreaterThan(0); // hour that does not exist
    expect(zonedDate(Date.parse("2026-10-24T05:30:00Z"), "America/Denver")).toBe("2026-10-23");
  });
});

const base: ReminderInput = { timeZone: "UTC", tasks: [], exams: [], classes: [], timetable: { rotationWeeks: 1, holidays: [] }, blocks: [], habits: [], subjects: [{ id: "s", uid: "u", name: "Physics", icon: "", color: "", category: "", totalMinutes: 0, sessionCount: 0, createdAt: "" }] };
const NOW = Date.parse("2026-10-23T08:00:00Z");

describe("planReminders", () => {
  it("tasks, exams, blocks, classes and habits with their times", () => {
    const r = planReminders({
      ...base,
      tasks: [
        { id: "t1", uid: "u", title: "Worksheet", completed: false, kind: "homework", dueDate: "2026-10-23", dueTime: "18:00", reminderMinutesBefore: 30, subjectId: "s", createdAt: "" },
        { id: "t2", uid: "u", title: "All day", completed: false, dueDate: "2026-10-24", reminderMinutesBefore: 0, createdAt: "" },
        { id: "t3", uid: "u", title: "Done", completed: true, dueDate: "2026-10-24", reminderMinutesBefore: 0, createdAt: "" },
        { id: "t4", uid: "u", title: "No reminder", completed: false, dueDate: "2026-10-24", createdAt: "" },
      ],
      exams: [{ id: "e", subjectId: "s", title: "Final", date: "2026-10-25", startTime: "10:00", room: "B2", reminderMinutesBefore: 1440, createdAt: 0 }],
      blocks: [{ id: "b", title: "Revise", date: "2026-10-23", start: "07:00", end: "08:00", reminderMinutesBefore: 10, createdAt: 0 }], // already past
      classes: [{ id: "c", subjectId: "s", room: "1", reminderMinutesBefore: 10, createdAt: 0, slots: [{ weekday: 1, start: "09:00", end: "10:00" }] }],
      habits: [{ id: "h", title: "Read", icon: "", color: "", schedule: { type: "daily" }, target: 1, reminderTime: "20:00", log: {}, createdAt: 0 }],
    }, NOW, "2026-10-23", 3);
    expect(r.map((x) => `${new Date(x.fireAt).toISOString().slice(5, 16)} ${x.title}`)).toEqual([
      "10-23T17:30 Homework: Worksheet", "10-23T20:00 Habit: Read", "10-24T09:00 All day", "10-24T10:00 Exam: Final",
      "10-24T20:00 Habit: Read", "10-25T20:00 Habit: Read", "10-26T08:50 Class: Physics", "10-26T20:00 Habit: Read",
    ]);
    expect(r[0].body).toBe("Due at 18:00 · Physics");
    expect(r.find((x) => x.title === "Exam: Final")!.body).toBe("Physics · starts 10:00 · Room B2");
    expect(new Set(r.map((x) => x.key)).size).toBe(r.length);
  });
  it("daily summary counts the day's work", () => {
    const r = planReminders({ ...base, dailySummaryTime: "07:30", cardsDue: { "2026-10-24": 12 },
      tasks: [{ id: "t", uid: "u", title: "x", completed: false, dueDate: "2026-10-24", createdAt: "" }] }, NOW, "2026-10-23", 1);
    expect(r.map((x) => x.body)).toEqual(["12 cards to review · 1 task due"]); // today's 07:30 already passed
  });
});

describe("diffReminders", () => {
  it("adds new, updates changed, removes cancelled unsent future and old sent", () => {
    const planned = [{ key: "a", fireAt: NOW + 10, title: "A", body: "", url: "", tag: "" }, { key: "b", fireAt: NOW + 20, title: "B2", body: "", url: "", tag: "" }];
    const stored = [
      { id: "b", sent: false, fireAt: NOW + 20, title: "B", body: "" },   // changed title
      { id: "c", sent: false, fireAt: NOW + 30, title: "C", body: "" },   // cancelled
      { id: "d", sent: true, fireAt: NOW - 3 * 86_400_000, title: "D", body: "" }, // old sent
      { id: "e", sent: true, fireAt: NOW - 100, title: "E", body: "" },   // recent sent: keep
      { id: "test-1", sent: false, fireAt: NOW + 5, title: "Test", body: "" }, // test reminder: keep
    ];
    const d = diffReminders(stored, planned, NOW);
    expect(d.upsert.map((p) => p.key)).toEqual(["a", "b"]);
    expect(d.remove).toEqual(["c", "d"]);
  });
});

describe("ics", () => {
  it("escapes text and folds long lines at 75 bytes", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
    const folded = foldLine("SUMMARY:" + "é".repeat(60));
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "é".repeat(60));
  });
  it("builds a valid calendar with timed and all-day events", () => {
    const events = feedEvents({
      ...base, timeZone: "America/Denver",
      exams: [{ id: "e", subjectId: "s", title: "Final, part 1", date: "2026-10-25", startTime: "10:00", durationMinutes: 90, room: "B2", createdAt: 0 }],
      tasks: [{ id: "t", uid: "u", title: "Essay", completed: false, kind: "homework", dueDate: "2026-10-24", createdAt: "" },
              { id: "x", uid: "u", title: "Done", completed: true, dueDate: "2026-10-24", createdAt: "" }],
      blocks: [{ id: "b", title: "Revise", date: "2026-10-24", start: "16:00", end: "17:30", createdAt: 0 }],
      classes: [{ id: "c", subjectId: "s", createdAt: 0, slots: [{ weekday: 1, start: "09:00", end: "10:00" }] }],
    }, "2026-10-19", "2026-10-31");
    const ics = buildIcs(events, "StudyPulse", Date.parse("2026-10-23T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("SUMMARY:Exam: Final\\, part 1 (Physics)\r\n");
    expect(ics).toContain("DTSTART:20261025T160000Z\r\nDTEND:20261025T173000Z");
    expect(ics).toContain("SUMMARY:Homework: Essay");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261024\r\nDTEND;VALUE=DATE:20261025");
    expect(ics).toContain("SUMMARY:Study: Revise");
    expect(ics).not.toContain("Done");
    expect(ics.match(/SUMMARY:Class: Physics/g)).toHaveLength(2); // Mondays Oct 19 and Oct 26
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});
