import { nextRepeat, dueKey, kindOf } from "./tasks";
import type { Task } from "@/types";

const base: Task = { id: "t1", uid: "u", title: "Revise ch. 3", completed: true, kind: "revision", examId: "e1", dueDate: "2026-10-20", repeatAfterDays: 3, createdAt: "x" };

describe("nextRepeat", () => {
  it("makes an open copy due N days after the finish day", () => {
    const next = nextRepeat(base, new Date(2026, 9, 23, 18, 0))!;
    expect(next.dueDate).toBe("2026-10-26");
    expect(next.completed).toBe(false);
    expect(next.examId).toBe("e1");
    expect(next.repeatAfterDays).toBe(3);
    expect("id" in next).toBe(false);
  });
  it("returns null when the task does not repeat", () => {
    expect(nextRepeat({ ...base, repeatAfterDays: undefined }, new Date())).toBeNull();
    expect(nextRepeat({ ...base, repeatAfterDays: 0 }, new Date())).toBeNull();
  });
});

describe("dueKey / kindOf", () => {
  it("orders by date then time, undated last", () => {
    const keys = [{ dueDate: "2026-10-24" }, { dueDate: "2026-10-24", dueTime: "08:00" }, {}, { dueDate: "2026-10-23" }].map(dueKey).sort();
    expect(keys).toEqual(["2026-10-23T99:99", "2026-10-24T08:00", "2026-10-24T99:99", "9999"]);
  });
  it("old tasks without a kind are plain tasks", () => {
    expect(kindOf({})).toBe("task");
  });
});
