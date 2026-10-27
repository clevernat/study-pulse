"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeUsername, setMemberName, setUsername, usernameTaken, USERNAME_RE } from "@/lib/firebase/members";

/** Your name (shown to admins and on your account) and your username, which you can pick once. */
export default function UsernameCard() {
  const { user, member } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [display, setDisplay] = useState<string | null>(null); // null = not editing
  if (!user || !member) return null;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = (display ?? "").trim();
    if (!n) return;
    await setMemberName(user.uid, n);
    setDisplay(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = normalizeUsername(name);
    if (!USERNAME_RE.test(n)) return setMessage({ ok: false, text: "Use 3 to 20 letters, numbers, dots or underscores." });
    setBusy(true);
    setMessage(null);
    try {
      if (await usernameTaken(n)) return setMessage({ ok: false, text: "That username is taken. Try another one." });
      await setUsername(user.uid, member.email, n);
      setMessage({ ok: true, text: "Saved. You can now sign in with this username and your password." });
    } catch {
      setMessage({ ok: false, text: "Could not save the username. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-card p-6 flex flex-col gap-3" data-testid="username-card">
      <h2 className="font-space font-semibold text-on-surface">Your name</h2>
      {display === null ? (
        <p className="text-sm text-on-surface-variant flex items-center gap-3 flex-wrap">
          <b className="text-on-surface" data-testid="name-value">{member.name}</b>
          <button type="button" data-testid="name-edit" onClick={() => setDisplay(member.name)} className="text-xs underline underline-offset-2 hover:text-primary">Change</button>
        </p>
      ) : (
        <form onSubmit={saveName} className="flex gap-2 max-w-sm">
          <input aria-label="Your name" data-testid="name-input" autoFocus maxLength={60} value={display} onChange={(e) => setDisplay(e.target.value)}
            className="flex-1 rounded-xl bg-surface-container border border-outline-variant px-3 py-2.5 text-sm text-on-surface" />
          <button type="submit" data-testid="name-save" disabled={!display.trim()} className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">Save</button>
          <button type="button" onClick={() => setDisplay(null)} className="px-3 py-2.5 text-sm text-on-surface-variant">Cancel</button>
        </form>
      )}
      <h2 className="font-space font-semibold text-on-surface mt-2">Username</h2>
      {member.username ? (
        <p className="text-sm text-on-surface-variant">Your username is <b className="text-on-surface" data-testid="username-value">@{member.username}</b>. Sign in with it or with {member.email}.</p>
      ) : (
        <>
          <p className="text-sm text-on-surface-variant">Pick a username to sign in with instead of your email (needs a password, set below). You can pick it once.</p>
          <form onSubmit={submit} className="flex gap-2 max-w-sm">
            <input aria-label="Username" data-testid="username-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ama_k" autoCapitalize="none"
              className="flex-1 rounded-xl bg-surface-container border border-outline-variant px-3 py-2.5 text-sm text-on-surface" />
            <button type="submit" disabled={busy || !name} data-testid="username-save" className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </form>
        </>
      )}
      {message && <p role="status" className={`text-sm ${message.ok ? "text-secondary" : "text-error"}`}>{message.text}</p>}
    </section>
  );
}
