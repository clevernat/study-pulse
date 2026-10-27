"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

/** Shown to someone who is signed in but not allowed in yet: email not confirmed, or not invited. */
export default function AccessGate() {
  const { authUser, access, recheckAccess, resendVerification, logOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const unverified = access === "unverified";

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true); setNote("");
    try { await fn(); setNote(done); } catch { setNote("That did not work. Try again in a minute."); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div data-testid="access-gate" data-access={access ?? ""} className="w-full max-w-md bg-card border border-outline-variant rounded-2xl p-8 flex flex-col items-center text-center gap-4">
        <span className={`w-16 h-16 rounded-full flex items-center justify-center ${unverified ? "bg-primary/15 text-primary" : "bg-tertiary/15 text-tertiary"}`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[32px]">{unverified ? "mark_email_unread" : "lock"}</span>
        </span>
        <h1 className="font-grotesk font-bold text-2xl text-on-surface">{unverified ? "Confirm your email" : "StudyPulse is invite only"}</h1>
        <p className="text-sm text-on-surface-variant">
          {unverified
            ? <>We sent a link to <span className="text-on-surface font-semibold">{authUser?.email}</span>. Open it, then press Continue.</>
            : <>There is no invite for <span className="text-on-surface font-semibold">{authUser?.email}</span>. Ask the admin to invite this email, then press Check again.</>}
        </p>
        <div className="flex flex-col gap-2 w-full mt-2">
          <button data-testid="access-recheck" disabled={busy} onClick={() => run(recheckAccess, "")}
            className="w-full bg-primary-container text-on-primary-container py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60">
            {unverified ? "Continue" : "Check again"}
          </button>
          {unverified && (
            <button disabled={busy} onClick={() => run(resendVerification, "Sent. Check your inbox and spam folder.")}
              className="w-full border border-outline-variant text-on-surface py-3 rounded-xl font-semibold text-sm hover:border-primary disabled:opacity-60">
              Send the link again
            </button>
          )}
          <button data-testid="access-signout" onClick={logOut} className="text-sm text-on-surface-variant underline underline-offset-2 mt-1">Sign out</button>
        </div>
        {note && <p role="status" className="text-xs text-on-surface-variant">{note}</p>}
      </div>
    </div>
  );
}
