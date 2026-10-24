"use client";
import { useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  type User,
} from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

/** Lets a Google account add (or change) a password, so the phone app can sign in with email + password. */
export default function PhonePasswordCard() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, refresh] = useState(0);

  if (!user?.email) return null;
  const hasPassword = user.providerData.some((p) => p.providerId === "password");

  const save = async (u: User) => {
    if (hasPassword) await updatePassword(u, password);
    else await linkWithCredential(u, EmailAuthProvider.credential(u.email!, password));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < 8) return setMessage({ ok: false, text: "Use at least 8 characters." });
    if (password !== confirm) return setMessage({ ok: false, text: "The two passwords are not the same." });
    setBusy(true);
    try {
      try {
        await save(user);
      } catch (err) {
        // Firebase asks for a fresh sign-in before it changes how you log in.
        if ((err as { code?: string }).code !== "auth/requires-recent-login") throw err;
        const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
        if (!isGoogle) throw err;
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
        await save(user);
      }
      await user.reload();
      setPassword("");
      setConfirm("");
      setMessage({ ok: true, text: `Saved. In the phone app, sign in with ${user.email} and this password.` });
      refresh((n) => n + 1);
    } catch (err) {
      const code = (err as { code?: string }).code;
      setMessage({
        ok: false,
        text: code === "auth/weak-password" ? "This password is too weak. Try a longer one."
          : code === "auth/popup-closed-by-user" ? "Google sign-in was closed. Try again."
          : "Could not save the password. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl bg-surface-container border border-outline-variant px-3 py-2.5 text-sm text-on-surface";
  return (
    <section className="glass-card p-6 flex flex-col gap-3" data-testid="phone-password-card">
      <h2 className="font-space font-semibold text-on-surface">Phone app sign-in</h2>
      <p className="text-sm text-on-surface-variant">
        {hasPassword
          ? <>The phone app signs in with <b className="text-on-surface">{user.email}</b> and your password. You can change the password here.</>
          : <>The StudyPulse phone app signs in with email and password. Set a password for <b className="text-on-surface">{user.email}</b>. Google sign-in on this website keeps working.</>}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 max-w-sm">
        <label className="text-xs text-outline" htmlFor="phone-pw">{hasPassword ? "New password" : "Password"}</label>
        <input id="phone-pw" type="password" autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="text-xs text-outline" htmlFor="phone-pw2">Type it again</label>
        <input id="phone-pw2" type="password" autoComplete="new-password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" disabled={busy || !password}
          className="self-start mt-1 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">
          {busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </button>
      </form>
      {message && (
        <p role="status" data-testid="phone-password-status" className={`text-sm ${message.ok ? "text-secondary" : "text-error"}`}>{message.text}</p>
      )}
    </section>
  );
}
