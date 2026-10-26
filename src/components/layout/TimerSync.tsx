"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTimerStore } from "@/store/timerStore";
import {
  subscribeSubjects,
  addSession,
  saveTimerState,
  subscribeTimerState,
  linkSessionToBlock,
} from "@/lib/firebase/firestore";
import { usePromptStore } from "@/store/promptStore";
import { useReflectionStore } from "@/store/reflectionStore";
import {
  playCompletionChime,
  playBreakEndChime,
  sendNotification,
} from "@/lib/sounds";
import { localDateStr } from "@/lib/dateUtils";
import type { Subject, Session } from "@/types";

// Per-tab device id — persisted to sessionStorage so navigation within the
// same tab keeps the same id, but a new phone tab gets a fresh one.
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

export default function TimerSync() {
  const { user } = useAuth();
  const state = useTimerStore((s) => s.state);
  const mode = useTimerStore((s) => s.mode);
  const startTimestamp = useTimerStore((s) => s.startTimestamp);
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  const selectedSubjectName = useTimerStore((s) => s.selectedSubjectName);
  const selectedTopicId = useTimerStore((s) => s.selectedTopicId); // a topic change is synced too
  const init = useTimerStore((s) => s.init);
  const hasHydrated = useTimerStore((s) => s._hasHydrated);
  const ownerUid = useTimerStore((s) => s.ownerUid);
  const setOwnerUid = useTimerStore((s) => s.setOwnerUid);
  const setPreset = useTimerStore((s) => s.setPreset);
  const setSubject = useTimerStore((s) => s.setSubject);
  const pomodoroLength = useTimerStore((s) => s.pomodoroLength);

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

  // Tracks which device owns the current focus session.
  // Only the owner calls saveSession() when focus ends, preventing duplicate
  // sessions from multiple devices running the same timer simultaneously.
  const sessionOwnerDeviceIdRef = useRef<string>(DEVICE_ID);

  // When the logged-in user changes, reset the timer if the stored state
  // belongs to a different account. Preserves state for the same user.
  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) return;
    if (ownerUid && ownerUid !== user.uid) {
      // Different account — wipe state so the new user starts fresh
      // (the old account's focus is not saved for the new one).
      focusStartMsRef.current = null;
      setPreset(pomodoroLength);
      setSubject("", "Select a Subject");
    }
    setOwnerUid(user.uid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, hasHydrated]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSubjects(user.uid, setSubjects);
    return () => unsub();
  }, [user]);

  // After Zustand hydrates from localStorage, sync tracking refs to real state.
  // Devices that own their localStorage state (e.g. page reload) keep ownership.
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
    // Assume we own the session from our own persisted state until Firestore
    // tells us otherwise via subscribeTimerState below.
    sessionOwnerDeviceIdRef.current = DEVICE_ID;
    hasInitializedRef.current = true;
  }, [hasHydrated]);

  // Pause-aware focus tracking.
  useEffect(() => {
    if (!applyingRemoteRef.current && mode === "focus") {
      if (state === "idle" && (prevStateRef.current === "running" || prevStateRef.current === "paused")) {
        // Stopped early (Reset, or new focus lengths): keep the time already studied.
        if (focusStartMsRef.current !== null) saveSession(60);
        useTimerStore.getState().resetDistractions();
        focusStartMsRef.current = null;
        focusPausedMsRef.current = 0;
        focusPauseStartMsRef.current = null;
      } else if (state === "running" && prevStateRef.current === "paused") {
        if (focusPauseStartMsRef.current !== null) {
          focusPausedMsRef.current += Date.now() - focusPauseStartMsRef.current;
          focusPauseStartMsRef.current = null;
        }
      } else if (state === "running" && prevStateRef.current !== "running") {
        useTimerStore.getState().resetDistractions(); // a new focus starts at 0
        startTimeRef.current = new Date().toTimeString().slice(0, 5);
        sessionTotalSecondsRef.current = totalSeconds;
        focusStartMsRef.current = Date.now();
        focusPausedMsRef.current = 0;
        focusPauseStartMsRef.current = null;
        // This device started focus locally — it owns the session.
        sessionOwnerDeviceIdRef.current = DEVICE_ID;
      } else if (state === "paused" && prevStateRef.current === "running") {
        focusPauseStartMsRef.current = Date.now();
      }
    }
    prevStateRef.current = state;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode]);

  /** Saves the current focus as a session. `minSecs`: skip it when less was studied (early stops). */
  const saveSession = useCallback(async (minSecs = 0) => {
    if (!user) return;
    // Only the device that started the focus session saves it.
    // This prevents duplicate sessions when multiple devices run the same timer.
    if (sessionOwnerDeviceIdRef.current !== DEVICE_ID) return;

    // Use selectedSubjectId directly from the store rather than looking up
    // subjects[], which may not have loaded yet on a secondary device.
    const storeState = useTimerStore.getState();
    const subjectId = storeState.selectedSubjectId;
    const subjectName = storeState.selectedSubjectName;
    const currentSubject = subjects.find((s) => s.id === subjectId);

    const now = new Date();
    const plannedSecs = sessionTotalSecondsRef.current;
    // A pause still going on (stopped while paused) is not study time either.
    const pausedMs = focusPausedMsRef.current +
      (focusPauseStartMsRef.current !== null ? Date.now() - focusPauseStartMsRef.current : 0);
    const totalElapsedMs = focusStartMsRef.current
      ? Date.now() - focusStartMsRef.current
      : plannedSecs * 1000;
    const studiedSecs = Math.min(
      Math.max(0, (totalElapsedMs - pausedMs) / 1000),
      plannedSecs
    );
    if (studiedSecs < minSecs) return;
    const durationMinutes = Math.max(1, Math.round(studiedSecs / 60));
    const focusScore =
      plannedSecs > 0
        ? Math.min(100, Math.round((studiedSecs / plannedSecs) * 100))
        : 100;

    // Derive start time from effective wall-clock moment the user actually
    // started studying: original start timestamp + all time spent paused.
    // This prevents a stale "17:40" start appearing when a session was paused
    // overnight and completed the next morning.
    const effectiveStartMs =
      focusStartMsRef.current !== null ? focusStartMsRef.current + pausedMs : null;
    const startTime = effectiveStartMs
      ? new Date(effectiveStartMs).toTimeString().slice(0, 5)
      : now.toTimeString().slice(0, 5);

    const session: Omit<Session, "id"> = {
      uid: user.uid,
      subjectId: subjectId || "unknown",
      subjectName: currentSubject?.name ?? subjectName,
      subjectColor: currentSubject?.color ?? "violet",
      durationMinutes,
      focusScore,
      pomodoroCount: 1,
      sessionType: storeState.sessionType ?? "Deep Work",
      date: localDateStr(now),
      startTime,
      endTime: now.toTimeString().slice(0, 5),
      notes: "",
      blockId: storeState.activeBlockId || undefined,
      ...(storeState.selectedTopicId ? { topicId: storeState.selectedTopicId, topicTitle: storeState.selectedTopicTitle } : {}),
      ...(storeState.distractions ? { distractions: storeState.distractions } : {}),
    };
    storeState.resetDistractions();
    try {
      const sessionId = await addSession(user.uid, session);
      if (session.blockId) {
        linkSessionToBlock(user.uid, session.blockId, sessionId, durationMinutes).catch((err) =>
          console.error("Failed to link session to block:", err));
      }
      if (currentSubject?.id) {
        usePromptStore.getState().setPending(currentSubject.id);
      }
      // Trigger reflection journal (only on the device that owns the session)
      useReflectionStore.getState().open(sessionId, session.subjectName);
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }, [user, subjects]);

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
      selectedTopicId: s.selectedTopicId,
      selectedTopicTitle: s.selectedTopicTitle,
      updatedAt: Date.now(),
      deviceId: DEVICE_ID,
      sessionOwnerDeviceId: sessionOwnerDeviceIdRef.current,
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

      // Restore session ownership from Firestore so we know whether this
      // device should save sessions for the current focus period.
      if (remote.sessionOwnerDeviceId) {
        sessionOwnerDeviceIdRef.current = remote.sessionOwnerDeviceId;
      }

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
        selectedTopicId: remote.selectedTopicId ?? "",
        selectedTopicTitle: remote.selectedTopicTitle ?? "",
      });
      init();
    });
    return () => unsub();
  }, [user, init]);

  // Auto-save to Firestore on any user-meaningful state change.
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (applyingRemoteRef.current) return;
    saveToFirestore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, startTimestamp, selectedTopicId]);

  // Save session on focus → break; reset focus tracking on break → focus.
  useEffect(() => {
    const prevMode = prevModeRef.current;

    // Read notification prefs from localStorage (set in Settings page)
    const sessionNotifOn = typeof window !== "undefined"
      ? localStorage.getItem("sp-notif-session") !== "false"
      : true;

    if (prevMode === "focus" && (mode === "short-break" || mode === "long-break")) {
      if (!applyingRemoteRef.current) {
        saveSession();
        playCompletionChime();
        if (sessionNotifOn) {
          sendNotification(
            "StudyPulse — Focus Complete! 🎉",
            `Great work${
              selectedSubjectName && selectedSubjectName !== "Select a Subject"
                ? ` on ${selectedSubjectName}`
                : ""
            }! Break time started.`
          );
        }
      }
    } else if (
      (prevMode === "short-break" || prevMode === "long-break") &&
      mode === "focus"
    ) {
      if (!applyingRemoteRef.current) {
        // This device auto-cycled break→focus locally — it owns the next session too.
        sessionOwnerDeviceIdRef.current = DEVICE_ID;
        startTimeRef.current = new Date().toTimeString().slice(0, 5);
        sessionTotalSecondsRef.current = totalSeconds;
        focusStartMsRef.current = Date.now();
        focusPausedMsRef.current = 0;
        focusPauseStartMsRef.current = null;
        playBreakEndChime();
        sendNotification("StudyPulse: break over", "Time to focus again.");
      }
    }

    prevModeRef.current = mode;
    applyingRemoteRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, saveSession, selectedSubjectName]);

  return null;
}
