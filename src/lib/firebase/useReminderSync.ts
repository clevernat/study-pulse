"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "./config";
import { useCollection } from "./useCollection";
import { useTimetable } from "./useTimetable";
import { queue, subscribeUserPreferences, saveUserPreferences, updateItem, type UserPrefs } from "./firestore";
import { showLocalNotification } from "./push";
import { planReminders, diffReminders } from "@/lib/reminders";
import { localDateStr } from "@/lib/dateUtils";
import { useAuth } from "@/context/AuthContext";
import type { Card, ClassItem, Exam, Habit, StudyBlock, Subject, Task } from "@/types";

interface StoredReminder { id: string; fireAt: number; sent: boolean; title: string; body: string; url: string; tag: string }

/**
 * Keeps users/{uid}/reminders in line with tasks, exams, classes, study blocks,
 * habits and the daily summary (next 14 days). The server sends them as push
 * messages; while the app is open, this hook also shows them itself.
 */
export function useReminderSync() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  // undefined = still loading; {} = no settings saved yet
  const [prefs, setPrefs] = useState<Partial<UserPrefs> | undefined>(undefined);
  useEffect(() => (uid ? subscribeUserPreferences(uid, (p) => setPrefs(p ?? {})) : undefined), [uid]);

  // Remember this device's time zone (the server needs it).
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    if (uid && prefs !== undefined && prefs.timeZone !== timeZone) saveUserPreferences(uid, { timeZone });
  }, [uid, prefs, timeZone]);

  const enabled = !!prefs?.remindersEnabled;
  const tasks = useCollection<Task>("tasks").items;
  const exams = useCollection<Exam>("exams").items;
  const classes = useCollection<ClassItem>("classes").items;
  const blocks = useCollection<StudyBlock>("studyBlocks").items;
  const habits = useCollection<Habit>("habits").items;
  const subjects = useCollection<Subject>("subjects").items;
  const cards = useCollection<Card>("cards").items;
  const stored = useCollection<StoredReminder>("reminders").items;
  const { settings: timetable } = useTimetable();

  const cardsDue = useMemo(() => {
    const out: Record<string, number> = {};
    const now = Date.now();
    for (const c of cards) {
      if (c.state === 0 || c.suspended) continue;
      const d = localDateStr(new Date(Math.max(c.due, now)));
      out[d] = (out[d] ?? 0) + 1;
    }
    return out;
  }, [cards]);

  // Write the plan (debounced so typing in forms does not cause many writes).
  const storedRef = useRef(stored);
  storedRef.current = stored;
  useEffect(() => {
    if (!uid || !enabled) return;
    const t = setTimeout(() => {
      const now = Date.now();
      const plan = planReminders({ timeZone, tasks, exams, classes, timetable, blocks, habits, subjects, cardsDue, dailySummaryTime: prefs?.dailySummaryTime || undefined }, now, localDateStr());
      const { upsert, remove } = diffReminders(storedRef.current, plan, now);
      if (upsert.length === 0 && remove.length === 0) return;
      const b = writeBatch(db);
      for (const r of upsert.slice(0, 400)) b.set(doc(db, "users", uid, "reminders", r.key), { fireAt: r.fireAt, title: r.title, body: r.body, url: r.url, tag: r.tag, sent: false });
      for (const id of remove.slice(0, 400 - Math.min(upsert.length, 400))) b.delete(doc(db, "users", uid, "reminders", id));
      queue(b.commit());
    }, 2000);
    return () => clearTimeout(t);
  }, [uid, enabled, timeZone, tasks, exams, classes, timetable, blocks, habits, subjects, cardsDue, prefs?.dailySummaryTime]);

  // While the app is open: show due reminders here (works without server push).
  useEffect(() => {
    if (!uid || !enabled) return;
    const check = () => {
      const now = Date.now();
      for (const r of storedRef.current) {
        if (r.sent || r.fireAt > now || r.fireAt < now - 10 * 60_000) continue;
        updateItem<StoredReminder>(uid, "reminders", r.id, { sent: true });
        showLocalNotification(r.title, r.body, r.url, r.tag);
      }
    };
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, [uid, enabled, stored.length]);
}
