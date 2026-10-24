// Always mounted while signed in (like the website's ClientShell):
// timer sync with other devices, timer preferences, phone reminders, timer alerts.
import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import TimerSync from "@/components/layout/TimerSync";
import { useTimerStore } from "@/store/timerStore";
import { useAuth } from "@/context/AuthContext";
import { subscribeTimerState, subscribeUserPreferences, hasTimerPrefs } from "@/lib/firebase/firestore";
import { useCollection } from "@/lib/firebase/useCollection";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { useComingCards } from "@/lib/firebase/useFlashcards";
import { planReminders } from "@/lib/reminders";
import { localDateStr } from "@/lib/dateUtils";
import type { ClassItem, Exam, Habit, StudyBlock, Subject, Task } from "@/types";
import { usePhoneSettings } from "~/lib/phone-settings";
import { routeForUrl, scheduleReminders, TIMER_ALERT_ID } from "~/lib/notifications";

export function AppSync() {
  useTimerLifecycle();
  usePhoneReminders();
  useTimerAlert();
  useNotificationTaps();
  return <TimerSync />;
}

/** Tapping a reminder opens the matching screen. */
function useNotificationTaps() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) =>
      router.navigate(routeForUrl(res.notification.request.content.data?.url)));
    return () => sub.remove();
  }, []);
}

/** Revives the timer after the app was in the background, and applies changes made on other devices. */
function useTimerLifecycle() {
  const { user } = useAuth();
  useEffect(() => {
    useTimerStore.getState().init();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") useTimerStore.getState().init(); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user) return;
    // All data was cleared on another device: stop the timer here too.
    const unsubTimer = subscribeTimerState(user.uid, (remote) => {
      if (remote !== null) return;
      const ts = useTimerStore.getState();
      if (ts.state !== "idle") { ts.setPreset(ts.pomodoroLength); ts.setSubject("", "Select a Subject"); }
    });
    // Timer lengths changed in Settings on any device.
    const unsubPrefs = subscribeUserPreferences(user.uid, (prefs) => {
      if (!hasTimerPrefs(prefs)) return;
      const ts = useTimerStore.getState();
      if (prefs.pomodoroLength === ts.pomodoroLength && prefs.shortBreak === ts.shortBreak && prefs.longBreak === ts.longBreak) return;
      if (ts.state === "idle") ts.setDurations(prefs.pomodoroLength, prefs.shortBreak, prefs.longBreak);
      else useTimerStore.setState({ pomodoroLength: prefs.pomodoroLength, shortBreak: prefs.shortBreak, longBreak: prefs.longBreak });
    });
    return () => { unsubTimer(); unsubPrefs(); };
  }, [user]);
}

/** Schedules the same reminders as the website (tasks, exams, classes, study blocks, habits, daily summary) on this phone. */
function usePhoneReminders() {
  const { remindersOn, dailySummaryTime } = usePhoneSettings();
  const tasks = useCollection<Task>("tasks").items;
  const exams = useCollection<Exam>("exams").items;
  const classes = useCollection<ClassItem>("classes").items;
  const blocks = useCollection<StudyBlock>("studyBlocks").items;
  const habits = useCollection<Habit>("habits").items;
  const subjects = useCollection<Subject>("subjects").items;
  const cards = useComingCards(15).items;
  const { settings: timetable } = useTimetable();

  useEffect(() => {
    // Debounced so editing a task does not reschedule many times.
    const t = setTimeout(() => {
      const now = Date.now();
      const cardsDue: Record<string, number> = {};
      for (const c of cards) {
        if (c.suspended) continue;
        const d = localDateStr(new Date(Math.max(c.due, now)));
        cardsDue[d] = (cardsDue[d] ?? 0) + 1;
      }
      const plan = remindersOn
        ? planReminders({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, tasks, exams, classes, timetable, blocks, habits, subjects, cardsDue,
          dailySummaryTime: dailySummaryTime || undefined }, now, localDateStr())
        : [];
      scheduleReminders(plan).catch((err) => console.error("Scheduling reminders failed:", err));
    }, 1500);
    return () => clearTimeout(t);
  }, [remindersOn, dailySummaryTime, tasks, exams, classes, timetable, blocks, habits, subjects, cards]);
}

/** While the timer runs, a notification is scheduled for the end of the current focus or break (shows if the app is closed). */
function useTimerAlert() {
  const state = useTimerStore((s) => s.state);
  const mode = useTimerStore((s) => s.mode);
  const startTimestamp = useTimerStore((s) => s.startTimestamp);
  const remainingWhenStarted = useTimerStore((s) => s.remainingWhenStarted);
  const subject = useTimerStore((s) => s.selectedSubjectName);
  const { timerAlertsOn } = usePhoneSettings();

  useEffect(() => {
    Notifications.cancelScheduledNotificationAsync(TIMER_ALERT_ID).catch(() => undefined);
    if (!timerAlertsOn || state !== "running" || startTimestamp === null) return;
    // Half a second early, so it is scheduled before the timer moves to the next phase and cancels it.
    const endsAt = startTimestamp + remainingWhenStarted * 1000 - 500;
    if (endsAt <= Date.now() + 1000) return;
    const focus = mode === "focus";
    Notifications.scheduleNotificationAsync({
      identifier: TIMER_ALERT_ID,
      content: {
        title: focus ? "Focus complete" : "Break over",
        body: focus ? `Good work${subject && subject !== "Select a Subject" ? ` on ${subject}` : ""}. Break time.` : "Time to focus again.",
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
    }).catch((err) => console.warn("Timer alert not scheduled:", err?.message ?? err));
  }, [state, mode, startTimestamp, remainingWhenStarted, subject, timerAlertsOn]);
}
