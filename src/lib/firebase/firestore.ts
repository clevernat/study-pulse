import { db } from "./config";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import type { Subject, Session, Goal, TimerSyncDoc } from "@/types";

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
  const ref = await addDoc(collection(db, "users", uid, "sessions"), {
    ...session,
    createdAt: serverTimestamp(),
  });
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
  const ref = await addDoc(collection(db, "users", uid, "subjects"), subject);
  return ref.id;
}

export async function updateSubject(
  uid: string,
  subjectId: string,
  updates: Partial<Subject>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "subjects", subjectId), updates);
}

export async function deleteSubject(
  uid: string,
  subjectId: string
): Promise<void> {
  // Delete all sessions belonging to this subject
  const sessionsSnap = await getDocs(
    query(collection(db, "users", uid, "sessions"), where("subjectId", "==", subjectId))
  );
  // Delete all goals belonging to this subject
  const goalsSnap = await getDocs(
    query(collection(db, "users", uid, "goals"), where("subjectId", "==", subjectId))
  );

  await Promise.all([
    ...sessionsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...goalsSnap.docs.map((d) => deleteDoc(d.ref)),
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
  const ref = await addDoc(collection(db, "users", uid, "goals"), goal);
  return ref.id;
}

export async function updateGoalProgress(
  uid: string,
  goalId: string,
  currentHours: number
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "goals", goalId), { currentHours });
}

export async function updateGoal(
  uid: string,
  goalId: string,
  updates: Partial<Omit<Goal, "id" | "uid">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "goals", goalId), updates);
}

export async function deleteGoal(uid: string, goalId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "goals", goalId));
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

export async function deleteAllUserData(uid: string): Promise<void> {
  const subcollections = ["sessions", "subjects", "goals"];
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
  cb: (state: TimerSyncDoc | null) => void
): () => void {
  return onSnapshot(
    doc(db, "users", uid, "timerState", "current"),
    (snap) => cb(snap.exists() ? (snap.data() as TimerSyncDoc) : null)
  );
}

// ── Cross-device preferences sync ────────────────────────────────────────────

export interface UserPrefs {
  pomodoroLength: number;
  shortBreak: number;
  longBreak: number;
}

export async function saveUserPreferences(uid: string, prefs: UserPrefs): Promise<void> {
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
