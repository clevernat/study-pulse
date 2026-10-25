// Who may use StudyPulse: members, invites, usernames and progress summaries.
// Rules in firestore.rules enforce all of this; these are the app's helpers.
import { db } from "./config";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc, writeBatch, type Unsubscribe } from "firebase/firestore";
import type { User } from "firebase/auth";
import type { Invite, Member, Progress, Role } from "@/types";
import { queue } from "./firestore";

/** The first admin. Keep in sync with owner() in firestore.rules. */
export const OWNER_EMAIL = "otengabrokwah950@gmail.com";

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
export const normalizeUsername = (s: string) => s.trim().toLowerCase().replace(/^@/, "");
const lower = (s: string) => s.trim().toLowerCase();

/** "ok" = can use the app; "unverified" = must confirm email first; "no-invite" = not invited (or removed). */
export type Access = "ok" | "unverified" | "no-invite";

/** Email for a username, or null when nobody has it. */
export async function emailForUsername(username: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "usernames", normalizeUsername(username)));
  return snap.exists() ? (snap.data().email as string) : null;
}

export async function usernameTaken(username: string): Promise<boolean> {
  return (await getDoc(doc(db, "usernames", normalizeUsername(username)))).exists();
}

/**
 * Called when someone signs in without a members/{uid} doc: joins them with
 * the role from their invite (the owner joins as admin). The username they
 * picked at sign-up travels in their profile's displayName.
 */
export async function claimMembership(user: User): Promise<Access> {
  const email = lower(user.email ?? "");
  if (!email) return "no-invite";
  if (!user.emailVerified) return "unverified";
  let role: Role = "admin";
  if (email !== OWNER_EMAIL) {
    const invite = await getDoc(doc(db, "invites", email));
    if (!invite.exists()) return "no-invite";
    role = invite.data().role as Role;
  }
  const picked = normalizeUsername(user.displayName ?? "");
  const username = USERNAME_RE.test(picked) && !(await usernameTaken(picked)) ? picked : undefined;
  const b = writeBatch(db);
  const member: Omit<Member, "id"> = { email, name: user.displayName || email.split("@")[0], role, joinedAt: Date.now(), ...(username ? { username } : {}) };
  b.set(doc(db, "members", user.uid), member);
  if (username) b.set(doc(db, "usernames", username), { uid: user.uid, email });
  if (email !== OWNER_EMAIL) b.delete(doc(db, "invites", email));
  await b.commit();
  return "ok";
}

/** A member picks a username later (once). */
export async function setUsername(uid: string, email: string, username: string): Promise<void> {
  const name = normalizeUsername(username);
  const b = writeBatch(db);
  b.update(doc(db, "members", uid), { username: name });
  b.set(doc(db, "usernames", name), { uid, email: lower(email) });
  await b.commit();
}

export function subscribeMember(uid: string, cb: (m: Member | null, fromCache: boolean) => void, onError: () => void): Unsubscribe {
  return onSnapshot(doc(db, "members", uid), { includeMetadataChanges: true },
    (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Member) : null, s.metadata.fromCache), onError);
}

function subscribeAll<T>(col: string, cb: (items: T[]) => void): Unsubscribe {
  return onSnapshot(collection(db, col), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T))));
}
export const subscribeMembers = (cb: (m: Member[]) => void) => subscribeAll<Member>("members", cb);
export const subscribeInvites = (cb: (i: Invite[]) => void) => subscribeAll<Invite>("invites", cb);
export const subscribeAllProgress = (cb: (p: Progress[]) => void) => subscribeAll<Progress>("progress", cb);

export async function invite(email: string, role: Role, invitedBy: string): Promise<void> {
  const e = lower(email);
  await queue(setDoc(doc(db, "invites", e), { email: e, role, invitedBy, createdAt: Date.now() }));
}

export const cancelInvite = (email: string) => queue(deleteDoc(doc(db, "invites", lower(email))));

export const setRole = (uid: string, role: Role) => queue(updateDoc(doc(db, "members", uid), { role }));

/** Takes away access. Their study data stays, unreadable, until they are invited again. */
export async function removeMember(m: Member): Promise<void> {
  const b = writeBatch(db);
  b.delete(doc(db, "members", m.id));
  b.delete(doc(db, "progress", m.id));
  if (m.username) b.delete(doc(db, "usernames", m.username));
  await queue(b.commit());
}

export const saveProgress = (uid: string, p: Omit<Progress, "id">) => queue(setDoc(doc(db, "progress", uid), p));
