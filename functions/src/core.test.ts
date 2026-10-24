// Runs on the Firestore emulator: npm run test:functions (from the app folder).
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { feedForToken, processDueReminders, type PushMessage } from "./core";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
if (!getApps().length) initializeApp({ projectId: "demo-studypulse" });
const db = getFirestore();
const TOKEN = "a".repeat(64);
const NOW = Date.parse("2026-10-23T12:00:00Z");

beforeAll(async () => {
  await db.doc(`calendarTokens/${TOKEN}`).set({ uid: "fn-user", createdAt: 1 });
  await db.doc("users/fn-user/preferences/current").set({ timeZone: "America/Denver" });
  await db.doc("users/fn-user/subjects/s").set({ name: "Physics" });
  await db.doc("users/fn-user/exams/e").set({ subjectId: "s", title: "Midterm", date: "2026-10-30", startTime: "09:00", durationMinutes: 60, createdAt: 0 });
  await db.doc("users/fn-user/tasks/t").set({ uid: "fn-user", title: "Lab report", completed: false, kind: "homework", dueDate: "2026-10-26", createdAt: "" });
  await db.doc("users/fn-user/classes/c").set({ subjectId: "s", room: "101", createdAt: 0, slots: [{ weekday: 2, start: "13:00", end: "14:00" }] });
});

describe("calendar feed", () => {
  it("returns the user's events for a valid token", async () => {
    const ics = (await feedForToken(db, TOKEN, NOW))!;
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Exam: Midterm (Physics)");
    expect(ics).toContain("DTSTART:20261030T150000Z"); // 09:00 Denver
    expect(ics).toContain("SUMMARY:Homework: Lab report");
    expect(ics).toContain("SUMMARY:Class: Physics");
  });
  it("returns nothing for unknown or malformed tokens", async () => {
    expect(await feedForToken(db, "b".repeat(64), NOW)).toBeNull();
    expect(await feedForToken(db, "../users/fn-user", NOW)).toBeNull();
  });
});

describe("processDueReminders", () => {
  it("sends due reminders once, skips future and stale ones, drops dead tokens", async () => {
    await db.doc("users/r-user/devices/d1").set({ fcmToken: "good-token" });
    await db.doc("users/r-user/devices/d2").set({ fcmToken: "dead-token" });
    await db.doc("users/r-user/reminders/due").set({ fireAt: NOW - 60_000, sent: false, title: "Exam: Midterm", body: "Room 1", url: "/exams/", tag: "exam-e" });
    await db.doc("users/r-user/reminders/future").set({ fireAt: NOW + 60_000, sent: false, title: "Later", body: "", url: "/", tag: "x" });
    await db.doc("users/r-user/reminders/stale").set({ fireAt: NOW - 2 * 86_400_000, sent: false, title: "Old", body: "", url: "/", tag: "y" });
    const calls: { tokens: string[]; msg: PushMessage }[] = [];
    const send = async (tokens: string[], msg: PushMessage) => { calls.push({ tokens, msg }); return ["dead-token"]; };

    const r1 = await processDueReminders(db, send, NOW);
    expect(r1).toEqual({ sent: 1, skipped: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].tokens.sort()).toEqual(["dead-token", "good-token"]);
    expect(calls[0].msg).toEqual({ title: "Exam: Midterm", body: "Room 1", url: "/exams/", tag: "exam-e" });
    expect((await db.doc("users/r-user/reminders/due").get()).get("sent")).toBe(true);
    expect((await db.doc("users/r-user/reminders/future").get()).get("sent")).toBe(false);
    expect((await db.doc("users/r-user/devices/d2").get()).exists).toBe(false);

    const r2 = await processDueReminders(db, send, NOW);
    expect(r2).toEqual({ sent: 0, skipped: 0 });
    expect(calls).toHaveLength(1);
  });
});
