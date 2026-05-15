"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTimerStore } from "@/store/timerStore";
import {
  subscribeSubjects,
  addSession,
  saveTimerState,
  subscribeTimerState,
} from "@/lib/firebase/firestore";
import {
  playCompletionChime,
  playBreakEndChime,
  requestNotificationPermission,
  sendNotification,
} from "@/lib/sounds";
import { localDateStr } from "@/lib/dateUtils";
import type { Subject, Session } from "@/types";

// Per-tab device id used to filter out our own Firestore writes from the
// subscribeTimerState callback. Persisted to sessionStorage so a navigation
// within the same tab keeps the same id.
const DEVICE_ID = (() => {
  if (typeof sessionStorage === "undefined") {
    return Math.random().toString(36).slice(2);
  }
  const stored = sessionStorage.getItem("sp-device-id");
  if (stored) return stored;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  sessionStorage.setItem("sp-device-id", id);
  return id;
})();

// Always-mounted (lives inside ClientShell) so session saving + cross-device
// sync continue to work even when the user is not on the /timer page.
export default function TimerSync() {
  const { user } = useAuth();
  const state = useTimerStore((s) => s.state);
  const mode = useTimerStore((s) => s.mode);
  const startTimestamp = useTimerStore((s) => s.startTimestamp);
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  const selectedSubjectId = useTimerStore((s) => s.selectedSubjectId);
  const selectedSubjectName = useTimerStore((s) => s.selectedSubjectName);
  const init = useTimerStore((s) => s.init);
  const hasHydrated = useTimerStore((s) => s._hasHydrated);

  const [subjects, setSubjects] = useState<Subject[]>([]);

  const prevStateRef = useRef<string>(state);
  const prevModeRef = useRef<string>(mode);
  const focusStartMsRef = useRef<number | null>(null);
  const focusPausedMsRef = useRef<number>(0);
  const focusPauseStartMsRef = useRef<number | null>(null);
  const startTimeRef = useRef<string | null>(null);
  const sessionTotalSecondsRef = useRef<number>(totalSeconds);
  const applyingRemoteRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSubjects(user.uid, setSubjects);
    return () => unsub();
  }, [user]);

  // After Zustand hydrates from localStorage, sync the tracking refs to the
  // real current state so the transition effects don't misfire on first render.
  useEffect(() => {
    if (!hasHydrated || hasInitializedRef.current) return;
    const s = useTimerStore.getState();
    prevStateRef.current = s.state;
    prevModeRef.current = s.mode;
    if (s.state === "running" && s.mode === "focus" && s.startTimestamp !== null) {
      focusStartMsRef.current = s.startTimestamp;
      focusPausedMsRef.current = 0;
      sessionTotalSecondsRef.current = s.totalSeconds;
    }
    hasInitializedRef.current = true;
  }, [hasHydrated]);

  // Pause-aware focus tracking.
  useEffect(() => {
    if (!applyingRemoteRef.current && mode === "focus") {
      if (state === "running" && prevStateRef.current === "paused") {
        if (focusPauseStartMsRef.current !== null) {
          focusPausedMsRef.current += Date.now() - focusPauseStartMsRef.current;
          focusPauseStartMsRef.current = null;
        }
      } else if (state === "running" && prevStateRef.current !== "running") {
        startTimeRef.current = new Date().toTimeString().slice(0, 5);
        sessionTotalSecondsRef.current = totalSeconds;
        focusStartMsRef.current = Date.now();
        focusPausedMsRef.current = 0;
        focusPauseStartMsRef.current = null;
      } else if (state === "paused" && prevStateRef.current === "running") {
        focusPauseStartMsRef.current = Date.now();
      }
    }
    prevStateRef.current = state;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode]);

  const saveSession = useCallback(async () => {
    if (!user) return;
    const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
    const now = new Date();
    const plannedSecs = sessionTotalSecondsRef.current;
    const totalElapsedMs = focusStartMsRef.current
      ? Date.now() - focusStartMsRef.current
      : plannedSecs * 1000;
    const pausedMs = focusPausedMsRef.current;
    const studiedSecs = Math.min(
      Math.max(0, (totalElapsedMs - pausedMs) / 1000),
      plannedSecs
    );
    const durationMinutes = Math.max(1, Math.round(studiedSecs / 60));
    const focusScore =
      plannedSecs > 0
        ? Math.min(100, Math.round((studiedSecs / plannedSecs) * 100))
        : 100;

    const session: Omit<Session, "id"> = {
      uid: user.uid,
      subjectId: currentSubject?.id ?? "unknown",
      subjectName: currentSubject?.name ?? selectedSubjectName,
      subjectColor: currentSubject?.color ?? "violet",
      durationMinutes,
      focusScore,
      pomodoroCount: 1,
      date: localDateStr(now),
      startTime: startTimeRef.current ?? now.toTimeString().slice(0, 5),
      endTime: now.toTimeString().slice(0, 5),
      notes: "",
    };
    try {
      await addSession(user.uid, session);
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }, [user, subjects, selectedSubjectId, selectedSubjectName]);

  const saveToFirestore = useCallback(async () => {
    if (!user) return;
    const s = useTimerStore.getState();
    await saveTimerState(user.uid, {
      timerState:
        s.state === "running" || s.state === "paused" ? s.state : "idle",
      mode: s.mode,
      startTimestamp: s.startTimestamp,
      remainingWhenStarted: s.remainingWhenStarted,
      totalSeconds: s.totalSeconds,
      pomodoroIndex: s.pomodoroIndex,
      totalPomodoros: s.totalPomodoros,
      pomodoroLength: s.pomodoroLength,
      shortBreak: s.shortBreak,
      longBreak: s.longBreak,
      selectedSubjectId: s.selectedSubjectId,
      selectedSubjectName: s.selectedSubjectName,
      updatedAt: Date.now(),
      deviceId: DEVICE_ID,
    });
  }, [user]);

  // Cross-device sync: apply non-null remote timer state from other devices.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeTimerState(user.uid, (remote) => {
      if (!remote) {
        applyingRemoteRef.current = true;
        focusStartMsRef.current = null;
        focusPausedMsRef.current = 0;
        focusPauseStartMsRef.current = null;
        startTimeRef.current = null;
        return;
      }
      if (remote.deviceId === DEVICE_ID) return;
      applyingRemoteRef.current = true;
      useTimerStore.setState({
        state: remote.timerState,
        mode: remote.mode,
        startTimestamp: remote.startTimestamp,
        remainingWhenStarted: remote.remainingWhenStarted,
        totalSeconds: remote.totalSeconds,
        pomodoroIndex: remote.pomodoroIndex,
        totalPomodoros: remote.totalPomodoros,
        pomodoroLength: remote.pomodoroLength,
        shortBreak: remote.shortBreak,
        longBreak: remote.longBreak,
        selectedSubjectId: remote.selectedSubjectId,
        selectedSubjectName: remote.selectedSubjectName,
      });
      init();
    });
    return () => unsub();
  }, [user, init]);

  // Auto-save to Firestore on any user-meaningful state change.
  // Declared BEFORE the mode-transition effect so it runs first and can skip
  // when applyingRemoteRef is still true (it gets reset by the next effect).
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (applyingRemoteRef.current) return;
    saveToFirestore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, startTimestamp]);

  // Save session on focus → break; reset focus tracking on break → focus.
  useEffect(() => {
    const prevMode = prevModeRef.current;

    if (prevMode === "focus" && (mode === "short-break" || mode === "long-break")) {
      if (!applyingRemoteRef.current) {
        saveSession();
        playCompletionChime();
        sendNotification(
          "StudyPulse — Focus Complete! 🎉",
          `Great work${
            selectedSubjectName && selectedSubjectName !== "Select a Subject"
              ? ` on ${selectedSubjectName}`
              : ""
          }! Break time started.`
        );
      }
    } else if (
      (prevMode === "short-break" || prevMode === "long-break") &&
      mode === "focus"
    ) {
      if (!applyingRemoteRef.current) {
        startTimeRef.current = new Date().toTimeString().slice(0, 5);
        sessionTotalSecondsRef.current = totalSeconds;
        focusStartMsRef.current = Date.now();
        focusPausedMsRef.current = 0;
        focusPauseStartMsRef.current = null;
        playBreakEndChime();
        sendNotification("StudyPulse — Break Over ⏱", "Back to focus — let's go!");
      }
    }

    prevModeRef.current = mode;
    applyingRemoteRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, saveSession, selectedSubjectName]);

  return null;
}
