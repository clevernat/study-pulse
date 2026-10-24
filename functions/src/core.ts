// Server logic, kept free of any one runtime: Cloud Functions (firebase-admin)
// and the Cloudflare Worker (Firestore REST) each pass their own Store.
import { buildIcs, feedEvents } from "../../src/lib/ics";
import { zonedDate } from "../../src/lib/zonedTime";
import { addDays } from "../../src/lib/timetable";
import type { ClassItem, Exam, StudyBlock, Subject, Task, TimetableSettings } from "../../src/types";

export const TOKEN_RE = /^[a-f0-9]{64}$/;

export type Data = Record<string, unknown>;
/** The few Firestore operations the server needs. Paths are like "users/u1/tasks/t1". */
export interface Store {
  get(path: string): Promise<Data | null>;
  list(collectionPath: string): Promise<(Data & { id: string })[]>;
  /** Reminders (any user) not sent yet with fireAt <= now. */
  dueReminders(now: number, limit: number): Promise<{ path: string; data: Data }[]>;
  update(path: string, fields: Data): Promise<void>;
  remove(path: string): Promise<void>;
}

const list = <T>(store: Store, uid: string, col: string) => store.list(`users/${uid}/${col}`) as Promise<T[]>;

/** The .ics text for a secret feed token, or null if the token is unknown. */
export async function feedForToken(store: Store, token: string, now = Date.now()): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null;
  const uid = (await store.get(`calendarTokens/${token}`))?.uid as string | undefined;
  if (!uid) return null;
  const [prefs, tt, subjects, exams, tasks, blocks, classes] = await Promise.all([
    store.get(`users/${uid}/preferences/current`),
    store.get(`users/${uid}/preferences/timetable`),
    list<Subject>(store, uid, "subjects"), list<Exam>(store, uid, "exams"), list<Task>(store, uid, "tasks"),
    list<StudyBlock>(store, uid, "studyBlocks"), list<ClassItem>(store, uid, "classes"),
  ]);
  const timeZone = (prefs?.timeZone as string | undefined) ?? "UTC";
  const timetable = { rotationWeeks: 1, holidays: [], ...(tt ?? {}) } as TimetableSettings;
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
export async function processDueReminders(store: Store, send: Sender, now = Date.now()): Promise<{ sent: number; skipped: number }> {
  const due = await store.dueReminders(now, 500);
  let sent = 0, skipped = 0;
  const tokensByUser = new Map<string, { id: string; token: string }[]>();
  for (const { path, data } of due) {
    const [, uid, , id] = path.split("/"); // users/{uid}/reminders/{id}
    if (!uid) continue;
    if (now - (data.fireAt as number) > 86_400_000) { await store.update(path, { sent: true, expired: true }); skipped++; continue; }
    if (!tokensByUser.has(uid)) {
      const devices = await store.list(`users/${uid}/devices`);
      tokensByUser.set(uid, devices.map((d) => ({ id: d.id, token: d.fcmToken as string })).filter((d) => d.token));
    }
    const devices = tokensByUser.get(uid)!;
    // Mark first so a slow send cannot cause a second copy on the next run.
    await store.update(path, { sent: true, sentAt: now, via: "push" });
    if (devices.length === 0) { skipped++; continue; }
    const bad = await send(devices.map((d) => d.token), { title: String(data.title ?? "StudyPulse"), body: String(data.body ?? ""), url: String(data.url ?? "/today/"), tag: String(data.tag ?? id) });
    for (const d of devices.filter((x) => bad.includes(x.token))) await store.remove(`users/${uid}/devices/${d.id}`);
    tokensByUser.set(uid, devices.filter((x) => !bad.includes(x.token)));
    sent++;
  }
  return { sent, skipped };
}
