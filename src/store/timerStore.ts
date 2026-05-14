"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TimerState, TimerSession } from "@/types";

// Module-level interval — React lifecycle cannot touch it
let _interval: ReturnType<typeof setInterval> | null = null;

function clearTick() {
  if (_interval !== null) {
    clearInterval(_interval);
    _interval = null;
  }
}

function modeSecs(mode: string, focus: number, shortB: number, longB: number): number {
  if (mode === "short-break") return shortB * 60;
  if (mode === "long-break") return longB * 60;
  return focus * 60;
}

interface TimerStore {
  state: TimerState;
  mode: "focus" | "short-break" | "long-break";
  secondsRemaining: number;
  totalSeconds: number;
  pomodoroIndex: number;
  totalPomodoros: number;
  selectedSubjectId: string;
  selectedSubjectName: string;
  pomodoroLength: number;
  shortBreak: number;
  longBreak: number;
  startTimestamp: number | null;
  remainingWhenStarted: number;

  init: () => void;
  setSubject: (id: string, name: string) => void;
  setPreset: (minutes: number) => void;
  setDurations: (focus: number, shortB: number, longB: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  getSession: () => TimerSession;
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      state: "idle",
      mode: "focus",
      secondsRemaining: 25 * 60,
      totalSeconds: 25 * 60,
      pomodoroIndex: 0,
      totalPomodoros: 4,
      selectedSubjectId: "",
      selectedSubjectName: "Select a Subject",
      pomodoroLength: 25,
      shortBreak: 5,
      longBreak: 15,
      startTimestamp: null,
      remainingWhenStarted: 25 * 60,

      // Called once after hydration from localStorage — restarts interval if timer was running
      init: () => {
        const { state, startTimestamp, remainingWhenStarted, pomodoroIndex, totalPomodoros, pomodoroLength, shortBreak, longBreak } = get();
        clearTick();

        if (state !== "running" || startTimestamp === null) return;

        const elapsed = (Date.now() - startTimestamp) / 1000;
        const actualRemaining = remainingWhenStarted - elapsed;

        if (actualRemaining <= 0) {
          // Timer expired while browser was closed — advance to next phase
          const nextIndex = pomodoroIndex + 1;
          const nextMode: "focus" | "short-break" | "long-break" =
            nextIndex % totalPomodoros === 0 ? "long-break" : "short-break";
          const secs = modeSecs(nextMode, pomodoroLength, shortBreak, longBreak);
          set({
            secondsRemaining: 0,
            totalSeconds: secs,
            state: "break",
            mode: nextMode,
            pomodoroIndex: nextIndex,
            startTimestamp: null,
            remainingWhenStarted: secs,
          });
        } else {
          // Still has time left — update remaining and restart interval
          set({ secondsRemaining: Math.ceil(actualRemaining) });
          _interval = setInterval(() => get().tick(), 250);
        }
      },

      setSubject: (id, name) => set({ selectedSubjectId: id, selectedSubjectName: name }),

      setDurations: (focus, shortB, longB) => {
        clearTick();
        const secs = focus * 60;
        set({
          pomodoroLength: focus,
          shortBreak: shortB,
          longBreak: longB,
          secondsRemaining: secs,
          totalSeconds: secs,
          state: "idle",
          mode: "focus",
          pomodoroIndex: 0,
          startTimestamp: null,
          remainingWhenStarted: secs,
        });
      },

      setPreset: (minutes) => {
        clearTick();
        set({
          pomodoroLength: minutes,
          secondsRemaining: minutes * 60,
          totalSeconds: minutes * 60,
          state: "idle",
          mode: "focus",
          pomodoroIndex: 0,
          startTimestamp: null,
          remainingWhenStarted: minutes * 60,
        });
      },

      start: () => {
        const { state, secondsRemaining, selectedSubjectId } = get();
        if (state === "running") return;
        // Require a subject to be selected before starting
        if (!selectedSubjectId) return;
        clearTick();
        const now = Date.now();
        set({ state: "running", startTimestamp: now, remainingWhenStarted: secondsRemaining });
        _interval = setInterval(() => get().tick(), 250);
      },

      pause: () => {
        const { startTimestamp, remainingWhenStarted } = get();
        clearTick();
        let remaining = remainingWhenStarted;
        if (startTimestamp !== null) {
          const elapsed = (Date.now() - startTimestamp) / 1000;
          remaining = Math.max(remainingWhenStarted - elapsed, 0);
        }
        set({ state: "paused", secondsRemaining: Math.ceil(remaining), startTimestamp: null });
      },

      reset: () => {
        clearTick();
        const { mode, pomodoroLength, shortBreak, longBreak } = get();
        const secs = modeSecs(mode, pomodoroLength, shortBreak, longBreak);
        set({ state: "idle", secondsRemaining: secs, totalSeconds: secs, startTimestamp: null, remainingWhenStarted: secs });
      },

      skip: () => {
        clearTick();
        const { pomodoroIndex, totalPomodoros, pomodoroLength, shortBreak, longBreak } = get();
        const nextIndex = pomodoroIndex + 1;
        const nextMode: "focus" | "short-break" | "long-break" =
          nextIndex % totalPomodoros === 0 ? "long-break" : "short-break";
        const secs = modeSecs(nextMode, pomodoroLength, shortBreak, longBreak);
        set({
          state: "break",
          mode: nextMode,
          pomodoroIndex: nextIndex,
          secondsRemaining: secs,
          totalSeconds: secs,
          startTimestamp: null,
          remainingWhenStarted: secs,
        });
      },

      tick: () => {
        const { startTimestamp, remainingWhenStarted, pomodoroIndex, totalPomodoros, pomodoroLength, shortBreak, longBreak } = get();
        if (startTimestamp === null) return;

        const elapsed = (Date.now() - startTimestamp) / 1000;
        const newRemaining = remainingWhenStarted - elapsed;

        if (newRemaining <= 0) {
          clearTick();
          const nextIndex = pomodoroIndex + 1;
          const nextMode: "focus" | "short-break" | "long-break" =
            nextIndex % totalPomodoros === 0 ? "long-break" : "short-break";
          const secs = modeSecs(nextMode, pomodoroLength, shortBreak, longBreak);
          set({
            secondsRemaining: 0,
            totalSeconds: secs,
            state: "break",
            mode: nextMode,
            pomodoroIndex: nextIndex,
            startTimestamp: null,
            remainingWhenStarted: secs,
          });
        } else {
          set({ secondsRemaining: Math.ceil(newRemaining) });
        }
      },

      getSession: () => {
        const s = get();
        return {
          subjectId: s.selectedSubjectId,
          subjectName: s.selectedSubjectName,
          pomodoroIndex: s.pomodoroIndex,
          totalPomodoros: s.totalPomodoros,
          secondsRemaining: s.secondsRemaining,
          totalSeconds: s.totalSeconds,
          state: s.state,
          mode: s.mode,
        };
      },
    }),
    {
      name: "studypulse-timer",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      // Only persist the data we need — not function references
      partialize: (s) => ({
        state: s.state,
        mode: s.mode,
        secondsRemaining: s.secondsRemaining,
        totalSeconds: s.totalSeconds,
        pomodoroIndex: s.pomodoroIndex,
        totalPomodoros: s.totalPomodoros,
        selectedSubjectId: s.selectedSubjectId,
        selectedSubjectName: s.selectedSubjectName,
        pomodoroLength: s.pomodoroLength,
        shortBreak: s.shortBreak,
        longBreak: s.longBreak,
        startTimestamp: s.startTimestamp,
        remainingWhenStarted: s.remainingWhenStarted,
      }),
    }
  )
);

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
