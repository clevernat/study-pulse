import { db } from "./config";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteField,
  arrayUnion,
  increment,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import type { Subject, Session, Goal, Task, TimerSyncDoc } from "@/types";

/**
 * Waits for a write, but at most 1.5 s. Online, the server confirms quickly.
 * Offline, Firestore keeps the change (and shows it at once) and sends it later,
 * so forms must not wait for the server forever.
 */
const OFFLINE_WAIT_MS = 1500;
export async function queue(write: Promise<unknown>): Promise<void> {
  write.catch((err) => console.error("Firestore write failed:", err));
  await Promise.race([write.catch(() => undefined), new Promise((r) => setTimeout(r, OFFLINE_WAIT_MS))]);
}

export async function getUserSessions(uid: string): Promise<Session[]> {
  const q = query(
    collection(db, "users", uid, "sessions"),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session));
}

export async function addSession(
  uid: string,
  session: Omit<Session, "id">
): Promise<string> {
  const ref = doc(collection(db, "users", uid, "sessions"));
  await queue(setDoc(ref, {
    ...session,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function getUserSubjects(uid: string): Promise<Subject[]> {
  const snap = await getDocs(collection(db, "users", uid, "subjects"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
}

export async function addSubject(
  uid: string,
  subject: Omit<Subject, "id">
): Promise<string> {
  const ref = doc(collection(db, "users", uid, "subjects"));
  await queue(setDoc(ref, subject));
  return ref.id;
}

export async function updateSubject(
  uid: string,
  subjectId: string,
  updates: Partial<Subject>
): Promise<void> {
  await queue(updateDoc(doc(db, "users", uid, "subjects", subjectId), updates));

  // Cascade name + color into the denormalized copies on sessions, goals, and tasks.
  // Without this, renaming a subject leaves stale labels on historical records.
  const renamePayload: Record<string, string> = {};
  if (typeof updates.name === "string") renamePayload.subjectName = updates.name;
  if (typeof updates.color === "string") renamePayload.subjectColor = updates.color;
  if (Object.keys(renamePayload).length === 0) return;

  const [sessionsSnap, goalsSnap, tasksSnap] = await Promise.all([
    getDocs(query(collection(db, "users", uid, "sessions"), where("subjectId", "==", subjectId))),
    getDocs(query(collection(db, "users", uid, "goals"),    where("subjectId", "==", subjectId))),
    getDocs(query(collection(db, "users", uid, "tasks"),    where("subjectId", "==", subjectId))),
  ]);

  await Promise.all([
    ...sessionsSnap.docs.map((d) => updateDoc(d.ref, renamePayload)),
    // goals + tasks only carry subjectName, ignore the color update for them
    ...goalsSnap.docs.map((d) =>
      renamePayload.subjectName ? updateDoc(d.ref, { subjectName: renamePayload.subjectName }) : Promise.resolve()
    ),
    ...tasksSnap.docs.map((d) =>
      renamePayload.subjectName ? updateDoc(d.ref, { subjectName: renamePayload.subjectName }) : Promise.resolve()
    ),
  ]);
}

/** Collections whose documents belong to one subject (deleted with the subject). */
export const SUBJECT_OWNED_COLLECTIONS = ["sessions", "goals", "topics", "exams", "classes", "decks", "notes", "results"];

export async function deleteSubject(
  uid: string,
  subjectId: string
): Promise<void> {
  const bySubject = (col: string) =>
    getDocs(query(collection(db, "users", uid, col), where("subjectId", "==", subjectId)));

  // Data that only makes sense with the subject is deleted with it.
  const owned = await Promise.all(SUBJECT_OWNED_COLLECTIONS.map(bySubject));
  // Cards belong to a deck (no subject field): delete the cards of this subject's decks too.
  const deckIds = owned[SUBJECT_OWNED_COLLECTIONS.indexOf("decks")].docs.map((d) => d.id);
  owned.push(...(await Promise.all(deckIds.map((id) => getDocs(query(collection(db, "users", uid, "cards"), where("deckId", "==", id)))))));
  // Tasks and study blocks stay, but lose their subject link.
  const linked = await Promise.all(["tasks", "studyBlocks"].map(bySubject));

  await Promise.all([
    ...owned.flatMap((snap) => snap.docs.map((d) => deleteDoc(d.ref))),
    ...linked.flatMap((snap) => snap.docs.map((d) => updateDoc(d.ref, { subjectId: deleteField(), subjectName: deleteField() }))),
    deleteDoc(doc(db, "users", uid, "subjects", subjectId)),
  ]);
}

export async function getUserGoals(uid: string): Promise<Goal[]> {
  const snap = await getDocs(collection(db, "users", uid, "goals"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal));
}

export async function addGoal(
  uid: string,
  goal: Omit<Goal, "id">
): Promise<string> {
  const ref = doc(collection(db, "users", uid, "goals"));
  await queue(setDoc(ref, goal));
  return ref.id;
}

export async function updateGoalProgress(
  uid: string,
  goalId: string,
  currentHours: number
): Promise<void> {
  await queue(updateDoc(doc(db, "users", uid, "goals", goalId), { currentHours }));
}

export async function updateGoal(
  uid: string,
  goalId: string,
  updates: Partial<Omit<Goal, "id" | "uid">>
): Promise<void> {
  await queue(updateDoc(doc(db, "users", uid, "goals", goalId), updates));
}

export async function deleteGoal(uid: string, goalId: string): Promise<void> {
  await queue(deleteDoc(doc(db, "users", uid, "goals", goalId)));
}

export async function updateSession(
  uid: string,
  sessionId: string,
  updates: Partial<Omit<Session, "id" | "uid">>
): Promise<void> {
  await queue(updateDoc(doc(db, "users", uid, "sessions", sessionId), updates));
}

export async function deleteSession(uid: string, sessionId: string): Promise<void> {
  await queue(deleteDoc(doc(db, "users", uid, "sessions", sessionId)));
}

export function subscribeSessions(uid: string, cb: (sessions: Session[]) => void): () => void {
  const q = query(collection(db, "users", uid, "sessions"), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session))));
}

export function subscribeSubjects(uid: string, cb: (subjects: Subject[]) => void): () => void {
  return onSnapshot(collection(db, "users", uid, "subjects"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject))));
}

export function subscribeGoals(uid: string, cb: (goals: Goal[]) => void): () => void {
  return onSnapshot(collection(db, "users", uid, "goals"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal))));
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function addTask(uid: string, task: Omit<Task, "id">): Promise<string> {
  const ref = doc(collection(db, "users", uid, "tasks"));
  await queue(setDoc(ref, task));
  return ref.id;
}

export async function updateTask(uid: string, taskId: string, updates: Partial<Omit<Task, "id" | "uid">>): Promise<void> {
  await queue(updateDoc(doc(db, "users", uid, "tasks", taskId), updates));
}

export async function deleteTask(uid: string, taskId: string): Promise<void> {
  await queue(deleteDoc(doc(db, "users", uid, "tasks", taskId)));
}

export function subscribeTasks(uid: string, cb: (tasks: Task[]) => void): () => void {
  return onSnapshot(collection(db, "users", uid, "tasks"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))));
}

export async function deleteAllUserData(uid: string): Promise<void> {
  // The secret calendar link lives outside users/{uid}: remove it first.
  try {
    const feed = await getDoc(doc(db, "users", uid, "calendarFeed", "current"));
    const token = feed.get("token") as string | undefined;
    if (token) await queue(deleteDoc(doc(db, "calendarTokens", token)));
  } catch {
    // no link
  }
  const subcollections = [
    "sessions", "subjects", "goals", "tasks", "topics", "exams", "classes", "studyBlocks",
    "habits", "decks", "notes", "cards", "reviewLogs", "reviewDays", "reminders", "devices", "preferences", "calendarFeed", "results",
  ];
  await Promise.all(
    subcollections.map(async (col) => {
      const snap = await getDocs(collection(db, "users", uid, col));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    })
  );
  // Also clear synced timer state
  try {
    await deleteDoc(doc(db, "users", uid, "timerState", "current"));
  } catch {
    // ignore if not present
  }
}

// ── Cross-device timer sync ───────────────────────────────────────────────────

export async function saveTimerState(
  uid: string,
  state: TimerSyncDoc
): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid, "timerState", "current"), state);
  } catch (err) {
    console.error("saveTimerState failed:", err);
  }
}

export function subscribeTimerState(
  uid: string,
  cb: (state: TimerSyncDoc | null, fromServer: boolean) => void
): () => void {
  return onSnapshot(
    doc(db, "users", uid, "timerState", "current"),
    (snap) => cb(snap.exists() ? (snap.data() as TimerSyncDoc) : null, !snap.metadata.fromCache)
  );
}

// ── Cross-device preferences sync ────────────────────────────────────────────

export interface UserPrefs {
  pomodoroLength: number;
  shortBreak: number;
  longBreak: number;
  /** IANA time zone of the user's device, used by the server for reminders and the calendar feed */
  timeZone?: string;
  /** Reminders are turned on */
  remindersEnabled?: boolean;
  /** "HH:MM" daily summary, or "" for none */
  dailySummaryTime?: string;
}

/** True when the document has usable timer lengths (it may only hold other settings). */
export function hasTimerPrefs(p: Partial<UserPrefs> | null): p is UserPrefs {
  return !!p && [p.pomodoroLength, p.shortBreak, p.longBreak].every((n) => typeof n === "number" && n > 0);
}

export async function saveUserPreferences(uid: string, prefs: Partial<UserPrefs>): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid, "preferences", "current"), prefs, { merge: true });
  } catch (err) {
    console.error("saveUserPreferences failed:", err);
  }
}

export function subscribeUserPreferences(
  uid: string,
  cb: (prefs: UserPrefs | null) => void
): () => void {
  return onSnapshot(
    doc(db, "users", uid, "preferences", "current"),
    (snap) => cb(snap.exists() ? (snap.data() as UserPrefs) : null)
  );
}

// ── Generic helpers for the newer collections (topics, exams, classes, ...) ──
// Every collection lives under users/{uid}/{col}. Values that are `undefined`
// in an update are removed from the document.

export function subscribeCollection<T extends { id: string }>(
  uid: string,
  col: string,
  cb: (items: T[]) => void
): () => void {
  return onSnapshot(collection(db, "users", uid, col), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T))));
}

export async function addItem<T extends { id: string }>(uid: string, col: string, data: Omit<T, "id">): Promise<string> {
  const ref = doc(collection(db, "users", uid, col));
  await queue(setDoc(ref, data));
  return ref.id;
}

export async function updateItem<T>(uid: string, col: string, id: string, updates: Partial<T>): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) payload[k] = v === undefined ? deleteField() : v;
  await queue(updateDoc(doc(db, "users", uid, col, id), payload));
}

export async function deleteItem(uid: string, col: string, id: string): Promise<void> {
  await queue(deleteDoc(doc(db, "users", uid, col, id)));
}

/** Live single document users/{uid}/{col}/{id} (null when missing). */
export function subscribeDocument<T>(uid: string, col: string, id: string, cb: (data: T | null) => void): () => void {
  return onSnapshot(doc(db, "users", uid, col, id), (snap) => cb(snap.exists() ? (snap.data() as T) : null));
}

export async function saveDocument<T extends object>(uid: string, col: string, id: string, data: T): Promise<void> {
  await queue(setDoc(doc(db, "users", uid, col, id), data));
}

/** Records a finished focus session on its planned study block. */
export async function linkSessionToBlock(uid: string, blockId: string, sessionId: string, minutes: number): Promise<void> {
  // Once per session, even if two devices save the same focus.
  const ref = doc(db, "users", uid, "studyBlocks", blockId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || ((snap.data().sessionIds as string[] | undefined) ?? []).includes(sessionId)) return;
    tx.update(ref, { sessionIds: arrayUnion(sessionId), minutesDone: increment(minutes) });
  });
}
