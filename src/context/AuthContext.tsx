"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { claimMembership, emailForUsername, normalizeUsername, subscribeMember, usernameTaken, USERNAME_RE, type Access } from "@/lib/firebase/members";
import type { Member } from "@/types";

interface AuthContextType {
  /** The signed-in member. Null until they are allowed in (invited and joined). */
  user: FirebaseUser | null;
  /** Whoever is signed in to Firebase, allowed in or not. */
  authUser: FirebaseUser | null;
  member: Member | null;
  isAdmin: boolean;
  access: Access | null;
  loading: boolean;
  /** `id` is an email or a username. */
  signIn: (id: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  /** After confirming the email (or being invited): look again. */
  recheckAccess: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Thrown for problems the login page explains (codes start with "app/"). */
const appError = (code: string) => Object.assign(new Error(code), { code });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setMember(null);
      setAccess(null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Watch members/{uid}: joined → in; missing → try to join with an invite.
  useEffect(() => {
    if (!authUser) return;
    let claiming = false;
    return subscribeMember(authUser.uid, async (m, fromCache) => {
      if (m) { setMember(m); setAccess("ok"); return; }
      if (fromCache || claiming) return; // wait for the server's answer
      setMember(null);
      claiming = true;
      try {
        const a = await claimMembership(authUser);
        if (a !== "ok") setAccess(a); // "ok": the new members doc arrives through this listener
      } catch (err) {
        console.error("Joining failed:", err);
        setAccess("no-invite");
      } finally {
        claiming = false;
      }
    }, () => setAccess("no-invite"));
  }, [authUser, checks]);

  const signIn = async (id: string, password: string) => {
    let email = id.trim();
    if (!email.includes("@")) {
      const found = await emailForUsername(email);
      if (!found) throw appError("auth/invalid-credential");
      email = found;
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, username: string, password: string) => {
    const name = normalizeUsername(username);
    if (!USERNAME_RE.test(name)) throw appError("app/bad-username");
    if (await usernameTaken(name)) throw appError("app/username-taken");
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name }); // claimMembership reserves it
    await sendEmailVerification(cred.user);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const recheckAccess = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true); // rules read email_verified from the token
    setAccess(null);
    setChecks((n) => n + 1);
  };

  const resendVerification = async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  };

  const user = access === "ok" ? authUser : null;
  const loading = authLoading || (!!authUser && access === null);

  return (
    <AuthContext.Provider value={{
      user, authUser, member, isAdmin: access === "ok" && member?.role === "admin", access, loading,
      signIn, signUp, signInWithGoogle, logOut, recheckAccess, resendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
