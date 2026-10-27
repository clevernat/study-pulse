import { withLive, LIVE_SESSION_ID } from "./liveFocus";
import type { Session } from "@/types";

const live = (minutes: number, active = true) => ({ active, minutes, subjectId: "net", subjectName: "Networking", topicId: "t1", topicTitle: "Subnetting" });

describe("withLive", () => {
  const now = new Date(2026, 9, 26, 10, 0);
  it("adds the running focus as a session of today, ending now", () => {
    const out = withLive([], live(9), now);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: LIVE_SESSION_ID, subjectId: "net", topicTitle: "Subnetting", durationMinutes: 9, date: "2026-10-26", startTime: "09:51", endTime: "10:00" });
  });
  it("adds nothing when no focus is running or under a minute has passed", () => {
    const saved = [{ id: "a" } as Session];
    expect(withLive(saved, live(5, false), now)).toBe(saved);
    expect(withLive(saved, live(0), now)).toBe(saved);
  });
});
