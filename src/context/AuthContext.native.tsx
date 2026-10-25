// Phone app (Expo) version of AuthContext.tsx: same shape, so shared hooks work.
// Google sign-in needs a store build; for now the phone signs in with email + password
// (set on the website in Settings → Phone app sign-in).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);

  const value: AuthContextType = {
    user,
    loading,
    signIn: async (email, password) => { await signInWithEmailAndPassword(auth, email.trim(), password); },
    signUp: async (email, password) => { await createUserWithEmailAndPassword(auth, email.trim(), password); },
    signInWithGoogle: async () => { throw new Error("Google sign-in is not available in the phone app yet."); },
    resetPassword: async (email) => { await sendPasswordResetEmail(auth, email.trim()); },
    logOut: async () => { await signOut(auth); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
