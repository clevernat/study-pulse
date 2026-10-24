// Server logic, kept free of Cloud Functions wiring so it can be tested on the emulator.
import type { Firestore } from "firebase-admin/firestore";
import { buildIcs, feedEvents } from "../../src/lib/ics";
import { zonedDate } from "../../src/lib/zonedTime";
import { addDays } from "../../src/lib/timetable";
import type { ClassItem, Exam, StudyBlock, Subject, Task, TimetableSettings } from "../../src/types";

export const TOKEN_RE = /^[a-f0-9]{64}$/;

async function list<T>(db: Firestore, uid: string, col: string): Promise<T[]> {
  const snap = await db.collection(`users/${uid}/${col}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** The .ics text for a secret feed token, or null if the token is unknown. */
export async function feedForToken(db: Firestore, token: string, now = Date.now()): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null;
  const tokenDoc = await db.doc(`calendarTokens/${token}`).get();
  const uid = tokenDoc.get("uid") as string | undefined;
  if (!uid) return null;
  const [prefs, tt, subjects, exams, tasks, blocks, classes] = await Promise.all([
    db.doc(`users/${uid}/preferences/current`).get(),
    db.doc(`users/${uid}/preferences/timetable`).get(),
    list<Subject>(db, uid, "subjects"), list<Exam>(db, uid, "exams"), list<Task>(db, uid, "tasks"),
    list<StudyBlock>(db, uid, "studyBlocks"), list<ClassItem>(db, uid, "classes"),
  ]);
  const timeZone = (prefs.get("timeZone") as string | undefined) ?? "UTC";
  const timetable = { rotationWeeks: 1, holidays: [], ...(tt.data() ?? {}) } as TimetableSettings;
  const today = zonedDate(now, timeZone);
  const events = feedEvents({ timeZone, subjects, exams, tasks, blocks, classes, timetable }, addDays(today, -30), addDays(today, 180));
  return buildIcs(events, "StudyPulse", now);
}

export interface PushMessage { title: string; body: string; url: string; tag: string }
/** Sends one message to these device tokens; returns the tokens that are no longer valid. */
export type Sender = (tokens: string[], msg: PushMessage) => Promise<string[]>;

/**
 * Sends every reminder that is due and not sent yet, then marks it sent.
 * Reminders more than 1 day late are only marked (not sent).
 */
export async function processDueReminders(db: Firestore, send: Sender, now = Date.now()): Promise<{ sent: number; skipped: number }> {
  const due = await db.collectionGroup("reminders").where("sent", "==", false).where("fireAt", "<=", now).limit(500).get();
  let sent = 0, skipped = 0;
  const tokensByUser = new Map<string, { id: string; token: string }[]>();
  for (const doc of due.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    const data = doc.data();
    if (now - (data.fireAt as number) > 86_400_000) { await doc.ref.update({ sent: true, expired: true }); skipped++; continue; }
    if (!tokensByUser.has(uid)) {
      const devices = await db.collection(`users/${uid}/devices`).get();
      tokensByUser.set(uid, devices.docs.map((d) => ({ id: d.id, token: d.get("fcmToken") as string })).filter((d) => d.token));
    }
    const devices = tokensByUser.get(uid)!;
    // Mark first so a slow send cannot cause a second copy on the next run.
    await doc.ref.update({ sent: true, sentAt: now, via: "push" });
    if (devices.length === 0) { skipped++; continue; }
    const bad = await send(devices.map((d) => d.token), { title: String(data.title ?? "StudyPulse"), body: String(data.body ?? ""), url: String(data.url ?? "/today/"), tag: String(data.tag ?? doc.id) });
    for (const d of devices.filter((x) => bad.includes(x.token))) await db.doc(`users/${uid}/devices/${d.id}`).delete();
    tokensByUser.set(uid, devices.filter((x) => !bad.includes(x.token)));
    sent++;
  }
  return { sent, skipped };
}
