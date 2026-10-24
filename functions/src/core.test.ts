// Runs on the Firestore emulator: npm run test:functions (from the app folder).
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { feedForToken, processDueReminders, type PushMessage, type Store } from "./core";
import { adminStore } from "./adminStore";
import { restStore } from "../../worker/src/firestoreRest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
if (!getApps().length) initializeApp({ projectId: "demo-studypulse" });
const db = getFirestore();
// The same tests run on both stores: firebase-admin (Cloud Functions) and REST (Cloudflare Worker).
const stores: [string, Store][] = [
  ["admin", adminStore(db)],
  ["rest", restStore("demo-studypulse", async () => "owner", `http://${process.env.FIRESTORE_EMULATOR_HOST}`)],
];
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

describe.each(stores)("calendar feed (%s store)", (_name, store) => {
  it("returns the user's events for a valid token", async () => {
    const ics = (await feedForToken(store, TOKEN, NOW))!;
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Exam: Midterm (Physics)");
    expect(ics).toContain("DTSTART:20261030T150000Z"); // 09:00 Denver
    expect(ics).toContain("SUMMARY:Homework: Lab report");
    expect(ics).toContain("SUMMARY:Class: Physics");
  });
  it("returns nothing for unknown or malformed tokens", async () => {
    expect(await feedForToken(store, "b".repeat(64), NOW)).toBeNull();
    expect(await feedForToken(store, "../users/fn-user", NOW)).toBeNull();
  });
});

describe.each(stores)("processDueReminders (%s store)", (name, store) => {
  it("sends due reminders once, skips future and stale ones, drops dead tokens", async () => {
    await db.doc(`users/r-${name}/devices/d1`).set({ fcmToken: "good-token" });
    await db.doc(`users/r-${name}/devices/d2`).set({ fcmToken: "dead-token" });
    await db.doc(`users/r-${name}/reminders/due`).set({ fireAt: NOW - 60_000, sent: false, title: "Exam: Midterm", body: "Room 1", url: "/exams/", tag: "exam-e" });
    await db.doc(`users/r-${name}/reminders/future`).set({ fireAt: NOW + 60_000, sent: false, title: "Later", body: "", url: "/", tag: "x" });
    await db.doc(`users/r-${name}/reminders/stale`).set({ fireAt: NOW - 2 * 86_400_000, sent: false, title: "Old", body: "", url: "/", tag: "y" });
    const calls: { tokens: string[]; msg: PushMessage }[] = [];
    const send = async (tokens: string[], msg: PushMessage) => { calls.push({ tokens, msg }); return ["dead-token"]; };

    const r1 = await processDueReminders(store, send, NOW);
    expect(r1).toEqual({ sent: 1, skipped: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].tokens.sort()).toEqual(["dead-token", "good-token"]);
    expect(calls[0].msg).toEqual({ title: "Exam: Midterm", body: "Room 1", url: "/exams/", tag: "exam-e" });
    expect((await db.doc(`users/r-${name}/reminders/due`).get()).get("sent")).toBe(true);
    expect((await db.doc(`users/r-${name}/reminders/future`).get()).get("sent")).toBe(false);
    expect((await db.doc(`users/r-${name}/devices/d2`).get()).exists).toBe(false);

    const r2 = await processDueReminders(store, send, NOW);
    expect(r2).toEqual({ sent: 0, skipped: 0 });
    expect(calls).toHaveLength(1);
  });
});

describe("Worker sign-in (service account JWT)", () => {
  it("signs a JWT that the matching public key verifies", async () => {
    const { signedJwt } = await import("../../worker/src/googleAuth");
    const keys = await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
    const jwt = await signedJwt({ client_email: "sa@x.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----\n` }, ["s1", "s2"], 1000);
    const [h, p, sig] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(claims).toEqual({ iss: "sa@x.iam.gserviceaccount.com", scope: "s1 s2", aud: "https://oauth2.googleapis.com/token", iat: 1000, exp: 4600 });
    expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", keys.publicKey, Buffer.from(sig, "base64url"), new TextEncoder().encode(`${h}.${p}`))).toBe(true);
  });
});
