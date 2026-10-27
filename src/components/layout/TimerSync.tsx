"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTimerStore } from "@/store/timerStore";
import {
  subscribeSubjects,
  saveDocument,
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
  const applyingRemoteRef = useRef<boolean>(false);
  /** True once the cloud timer has been read; until then this tab must not overwrite it */
  const remoteLoadedRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);

  // The device that started the focus. Saving does NOT depend on it (any device
  // saves, under one fixed id); it only decides which device links a planned block.
  const sessionOwnerDeviceIdRef = useRef<string>(DEVICE_ID);

  // When the logged-in user changes, reset the timer if the stored state
  // belongs to a different account. Preserves state for the same user.
  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) return;
    if (ownerUid && ownerUid !== user.uid) {
      // Different account — wipe state so the new user starts fresh
      // (the old account's focus is not saved for the new one).
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
    // Assume we own the session from our own persisted state until Firestore
    // tells us otherwise via subscribeTimerState below.
    sessionOwnerDeviceIdRef.current = DEVICE_ID;
    hasInitializedRef.current = true;
  }, [hasHydrated]);

  // A new focus starts with 0 distractions, and this device owns it.
  useEffect(() => {
    if (!applyingRemoteRef.current && mode === "focus") {
      if (state === "idle" && (prevStateRef.current === "running" || prevStateRef.current === "paused")) {
        useTimerStore.getState().resetDistractions();
      } else if (state === "running" && prevStateRef.current === "idle") {
        useTimerStore.getState().resetDistractions();
        sessionOwnerDeviceIdRef.current = DEVICE_ID;
      }
    }
    prevStateRef.current = state;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode]);

  // Save every focus the timer recorded as ended (time up, stopped, skipped,
  // or found ended when the app reopened). The id is fixed per focus, so a
  // second device or tab saving the same focus writes the same document.
  const finishedFocuses = useTimerStore((s) => s.finishedFocuses);
  const savingRef = useRef(new Set<string>());
  useEffect(() => {
    if (!user || !finishedFocuses?.length) return;
    const clear = useTimerStore.getState().clearFinished;
    for (const f of finishedFocuses) {
      if (savingRef.current.has(f.id)) continue;
      if (f.ownerUid && f.ownerUid !== user.uid) { clear(f.id); continue; } // another account's focus
      savingRef.current.add(f.id);
      const end = new Date(f.endedAt);
      const hhmm = (d: Date) => d.toTimeString().slice(0, 5);
      const sub = subjects.find((x) => x.id === f.subjectId);
      const durationMinutes = Math.max(1, Math.round(f.studiedSecs / 60));
      const session: Omit<Session, "id"> & { createdAt: number } = {
        uid: user.uid,
        subjectId: f.subjectId,
        subjectName: sub?.name ?? f.subjectName,
        subjectColor: sub?.color ?? "violet",
        durationMinutes,
        focusScore: f.plannedSecs > 0 ? Math.min(100, Math.round((f.studiedSecs / f.plannedSecs) * 100)) : 100,
        pomodoroCount: 1,
        sessionType: f.sessionType || "Deep Work",
        date: localDateStr(end),
        startTime: hhmm(new Date(f.endedAt - f.studiedSecs * 1000)),
        endTime: hhmm(end),
        notes: "",
        ...(f.activeBlockId ? { blockId: f.activeBlockId } : {}),
        ...(f.topicId ? { topicId: f.topicId, topicTitle: f.topicTitle } : {}),
        ...(f.distractions ? { distractions: f.distractions } : {}),
        createdAt: f.endedAt,
      };
      saveDocument(user.uid, "sessions", f.id, session)
        .then(() => {
          clear(f.id);
          if (f.activeBlockId) linkSessionToBlock(user.uid, f.activeBlockId, f.id, durationMinutes).catch((err) => console.error("Failed to link session to block:", err));
          if (Date.now() - f.endedAt < 10 * 60_000) { // just now: ask how it went
            if (sub?.id) usePromptStore.getState().setPending(sub.id);
            useReflectionStore.getState().open(f.id, session.subjectName);
          }
        })
        .catch((err) => console.error("Failed to save session:", err))
        .finally(() => savingRef.current.delete(f.id));
    }
  }, [user, finishedFocuses, subjects]);

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
      focusStartedAt: s.focusStartedAt ?? null,
      updatedAt: Date.now(),
      deviceId: DEVICE_ID,
      sessionOwnerDeviceId: sessionOwnerDeviceIdRef.current,
    });
  }, [user]);

  // Cross-device sync: apply non-null remote timer state from other devices.
  useEffect(() => {
    if (!user) return;
    remoteLoadedRef.current = false;
    const unsub = subscribeTimerState(user.uid, (remote) => {
      const first = !remoteLoadedRef.current;
      remoteLoadedRef.current = true;
      if (!remote) return; // nothing saved yet, or data cleared on another device (ClientShell stops the timer)
      // Opening the app: if this tab has nothing running, take the cloud timer as it is
      if (first && remote.deviceId === DEVICE_ID) return;
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
        ...(remote.focusStartedAt !== undefined ? { focusStartedAt: remote.focusStartedAt } : {}),
      });
      init();
    });
    return () => unsub();
  }, [user, init]);

  // Send changes made in this tab (never on opening, never echoes of other devices).
  useEffect(() => {
    if (!hasInitializedRef.current || !remoteLoadedRef.current) return;
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
        playBreakEndChime();
        sendNotification("StudyPulse: break over", "Time to focus again.");
      }
    }

    prevModeRef.current = mode;
    applyingRemoteRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, selectedSubjectName]);

  return null;
}
