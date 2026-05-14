import { db } from "./config";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import type { Subject, Session, Goal } from "@/types";

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
  await deleteDoc(doc(db, "users", uid, "subjects", subjectId));
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
