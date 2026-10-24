"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeUserPreferences, saveUserPreferences, saveDocument, type UserPrefs } from "@/lib/firebase/firestore";
import { enableNotifications, type PushStatus } from "@/lib/firebase/push";
import { isIos, isInstalled } from "@/lib/pwa";
import { inputCls } from "@/components/ui/Field";

const STATUS_TEXT: Record<PushStatus, string> = {
  push: "Reminders are on. They also arrive when the app is closed.",
  "app-only": "Reminders are on while StudyPulse is open on this device.",
  denied: "Notifications are blocked. Allow them in your browser or phone settings, then try again.",
  "needs-install": "On iPhone and iPad, first add StudyPulse to your Home Screen (see above), then turn reminders on from the app icon.",
  unsupported: "This browser cannot show notifications.",
};

export default function RemindersCard() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Partial<UserPrefs> | null>(null);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);
  useEffect(() => (user ? subscribeUserPreferences(user.uid, setPrefs) : undefined), [user]);
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "denied") setStatus("denied");
    else if (isIos() && !isInstalled() && typeof Notification === "undefined") setStatus("needs-install");
  }, []);
  if (!user) return null;
  const on = !!prefs?.remindersEnabled;

  async function turnOn() {
    setBusy(true);
    const s = await enableNotifications(user!.uid);
    setStatus(s);
    if (s === "push" || s === "app-only") await saveUserPreferences(user!.uid, { remindersEnabled: true, dailySummaryTime: prefs?.dailySummaryTime ?? "07:30" });
    setBusy(false);
  }

  async function sendTest() {
    const id = `test-${Date.now()}`;
    await saveDocument(user!.uid, "reminders", id, { fireAt: Date.now() + 3000, sent: false, title: "Test reminder", body: "Reminders work on this device.", url: "/today/", tag: id });
    setTestSent(true);
  }

  return (
    <section className="glass-card p-6 flex flex-col gap-3" data-testid="reminders-card">
      <h2 className="font-space font-semibold text-[#e8e8f0]">Reminders</h2>
      <p className="text-sm text-on-surface-variant">Get a notification before tasks, exams, classes and study blocks (choose the time on each item), for habits, and a daily summary.{!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY && " Reminders appear while StudyPulse is open (in a tab or as the installed app)."}</p>
      {!on ? (
        <button data-testid="reminders-on" disabled={busy} onClick={turnOn} className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">
          <span className="material-symbols-outlined text-[18px]">notifications_active</span>Turn on reminders
        </button>
      ) : (
        <>
          <label className="flex items-center gap-3 text-sm text-on-surface">
            Daily summary at
            <select data-testid="summary-time" className={`${inputCls} !w-auto`} value={prefs?.dailySummaryTime ?? ""} onChange={(e) => saveUserPreferences(user.uid, { dailySummaryTime: e.target.value })}>
              <option value="">No summary</option>
              {["06:30", "07:00", "07:30", "08:00", "09:00", "12:00", "18:00", "20:00"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div className="flex gap-2 flex-wrap">
            <button data-testid="reminders-test" onClick={sendTest} className="px-3 py-2 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface">Send a test reminder</button>
            <button onClick={turnOn} className="px-3 py-2 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface">Set up this device again</button>
            <button data-testid="reminders-off" onClick={() => saveUserPreferences(user.uid, { remindersEnabled: false })} className="px-3 py-2 rounded-xl text-sm text-error">Turn off</button>
          </div>
          {testSent && <p className="text-xs text-on-surface-variant">A test reminder will appear in a few seconds.</p>}
        </>
      )}
      {status && <p data-testid="reminders-status" className={`text-sm ${status === "push" || status === "app-only" ? "text-secondary" : "text-tertiary"}`}>{STATUS_TEXT[status]}</p>}
    </section>
  );
}
