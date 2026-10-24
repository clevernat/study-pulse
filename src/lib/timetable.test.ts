import { rotationWeekFor, classOccurrences, findClashes, mondayOf, weekdayOf, holidayOn, validSlot } from "./timetable";
import type { ClassItem, Exam, TimetableSettings } from "@/types";

const s = (over: Partial<TimetableSettings> = {}): TimetableSettings => ({ rotationWeeks: 1, holidays: [], ...over });
// 2026-10-19 is a Monday
const maths: ClassItem = { id: "c1", subjectId: "math", room: "101", createdAt: 0,
  slots: [{ weekday: 1, start: "09:00", end: "10:00" }, { weekday: 3, start: "13:00", end: "14:30" }] };
const labA: ClassItem = { id: "c2", subjectId: "bio", title: "Lab", createdAt: 0, slots: [{ weekday: 2, start: "10:00", end: "12:00", week: 1 }] };
const labB: ClassItem = { id: "c3", subjectId: "chem", title: "Lab", createdAt: 0, slots: [{ weekday: 2, start: "10:00", end: "12:00", week: 2 }] };

describe("date helpers", () => {
  it("weekday and monday", () => {
    expect(weekdayOf("2026-10-19")).toBe(1);
    expect(weekdayOf("2026-10-25")).toBe(0);
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
  });
  it("valid slot", () => {
    expect(validSlot("09:00", "10:00")).toBe(true);
    expect(validSlot("10:00", "10:00")).toBe(false);
  });
});

describe("rotationWeekFor", () => {
  const ab = s({ rotationWeeks: 2, rotationStartDate: "2026-10-21" }); // Wed of week A
  it("alternates A/B from the start week (Monday based)", () => {
    expect(rotationWeekFor("2026-10-19", ab)).toBe(1);
    expect(rotationWeekFor("2026-10-25", ab)).toBe(1);
    expect(rotationWeekFor("2026-10-26", ab)).toBe(2);
    expect(rotationWeekFor("2026-11-02", ab)).toBe(1);
  });
  it("works before the start date", () => {
    expect(rotationWeekFor("2026-10-12", ab)).toBe(2);
  });
  it("is always 1 without rotation", () => {
    expect(rotationWeekFor("2026-11-02", s())).toBe(1);
  });
});

describe("classOccurrences", () => {
  it("lists weekly classes in date order", () => {
    const occ = classOccurrences([maths], s(), "2026-10-19", "2026-10-25");
    expect(occ.map((o) => `${o.date} ${o.start}`)).toEqual(["2026-10-19 09:00", "2026-10-21 13:00"]);
    expect(occ[0].room).toBe("101");
  });
  it("respects A/B weeks", () => {
    const ab = s({ rotationWeeks: 2, rotationStartDate: "2026-10-19" });
    const w1 = classOccurrences([labA, labB], ab, "2026-10-19", "2026-10-25").map((o) => o.classId);
    const w2 = classOccurrences([labA, labB], ab, "2026-10-26", "2026-11-01").map((o) => o.classId);
    expect(w1).toEqual(["c2"]);
    expect(w2).toEqual(["c3"]);
  });
  it("skips holidays and days outside the term", () => {
    const set = s({ termStart: "2026-10-20", termEnd: "2026-10-30", holidays: [{ name: "Break", start: "2026-10-26", end: "2026-10-27" }] });
    const dates = classOccurrences([maths], set, "2026-10-12", "2026-11-06").map((o) => o.date);
    expect(dates).toEqual(["2026-10-21", "2026-10-28"]);
    expect(holidayOn("2026-10-27", set.holidays)?.name).toBe("Break");
  });
});

describe("findClashes", () => {
  const exam = (startTime: string | undefined, durationMinutes?: number): Exam =>
    ({ id: "e", subjectId: "x", title: "Final", date: "2026-10-21", startTime, durationMinutes, createdAt: 0 });
  it("finds an overlap on the same day", () => {
    const c = findClashes([exam("12:30", 60)], [maths], s());
    expect(c).toHaveLength(1);
    expect(c[0].occurrence.start).toBe("13:00");
  });
  it("touching times do not clash", () => {
    expect(findClashes([exam("14:30", 60)], [maths], s())).toHaveLength(0);
    expect(findClashes([exam("12:00", 60)], [maths], s())).toHaveLength(0);
  });
  it("uses 60 minutes when the length is unknown, ignores exams without time", () => {
    expect(findClashes([exam("12:30")], [maths], s())).toHaveLength(1);
    expect(findClashes([exam(undefined)], [maths], s())).toHaveLength(0);
  });
});
