"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TimerState, TimerSession } from "@/types";

// Single module-level interval — never restarted from inside a tick callback
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
  // Not persisted — always false on page load, set to true after localStorage hydrates.
  // Components use this to avoid treating hydration as a real state transition.
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;

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
  setTotalPomodoros: (n: number) => void;
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
      _hasHydrated: false,
      setHasHydrated: (val) => set({ _hasHydrated: val }),

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

      init: () => {
        const s = get();
        clearTick();

        // Migrate old "break" state
        if (s.state === "break") {
          const secs = s.pomodoroLength * 60;
          set({ state: "idle", mode: "focus", secondsRemaining: secs, totalSeconds: secs, startTimestamp: null, remainingWhenStarted: secs });
          return;
        }

        if (s.state !== "running" || s.startTimestamp === null) return;

        const elapsed = (Date.now() - s.startTimestamp) / 1000;
        const actualRemaining = s.remainingWhenStarted - elapsed;

        if (actualRemaining <= 0) {
          // Expired while tab was closed — advance phase
          if (s.mode === "focus") {
            const nextIdx = s.pomodoroIndex + 1;
            const nextMode: "focus" | "short-break" | "long-break" =
              nextIdx % s.totalPomodoros === 0 ? "long-break" : "short-break";
            const breakSecs = modeSecs(nextMode, s.pomodoroLength, s.shortBreak, s.longBreak);
            const timeIntoBreak = -actualRemaining; // seconds elapsed after focus ended
            const now = Date.now();
            if (timeIntoBreak >= breakSecs) {
              // Break also expired while away — still transition through break so the
              // React effect on the timer page detects focus→break and saves the session.
              // Set 1 s remaining so it ticks to 0 and auto-advances to focus immediately.
              set({ mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: 1, totalSeconds: breakSecs, startTimestamp: now, remainingWhenStarted: 1 });
            } else {
              const breakRemaining = breakSecs - timeIntoBreak;
              set({ mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: Math.ceil(breakRemaining), totalSeconds: breakSecs, startTimestamp: now, remainingWhenStarted: Math.ceil(breakRemaining) });
            }
          } else {
            const secs = s.pomodoroLength * 60;
            const now = Date.now();
            // Reset index when coming back from a long-break (matching tick() behaviour)
            const resetIdx = s.pomodoroIndex % s.totalPomodoros === 0 ? 0 : s.pomodoroIndex;
            set({ mode: "focus", pomodoroIndex: resetIdx, secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs });
          }
        } else {
          set({ secondsRemaining: Math.ceil(actualRemaining) });
        }

        // Restart the single interval
        _interval = setInterval(() => get().tick(), 500);
      },

      setSubject: (id, name) => set({ selectedSubjectId: id, selectedSubjectName: name }),

      setDurations: (focus, shortB, longB) => {
        clearTick();
        const secs = focus * 60;
        set({ pomodoroLength: focus, shortBreak: shortB, longBreak: longB, secondsRemaining: secs, totalSeconds: secs, state: "idle", mode: "focus", pomodoroIndex: 0, startTimestamp: null, remainingWhenStarted: secs });
      },

      setTotalPomodoros: (n) => {
        clearTick();
        const secs = get().pomodoroLength * 60;
        set({ totalPomodoros: n, pomodoroIndex: 0, state: "idle", mode: "focus", secondsRemaining: secs, totalSeconds: secs, startTimestamp: null, remainingWhenStarted: secs });
      },

      setPreset: (minutes) => {
        clearTick();
        set({ pomodoroLength: minutes, secondsRemaining: minutes * 60, totalSeconds: minutes * 60, state: "idle", mode: "focus", pomodoroIndex: 0, startTimestamp: null, remainingWhenStarted: minutes * 60 });
      },

      // User presses play once — interval runs until paused/reset
      start: () => {
        const s = get();
        if (s.state === "running") return;
        if (!s.selectedSubjectId) return;
        clearTick();
        const now = Date.now();
        set({ state: "running", startTimestamp: now, remainingWhenStarted: s.secondsRemaining });
        _interval = setInterval(() => get().tick(), 500);
      },

      pause: () => {
        const { startTimestamp, remainingWhenStarted } = get();
        clearTick();
        let remaining = remainingWhenStarted;
        if (startTimestamp !== null) {
          remaining = Math.max(remainingWhenStarted - (Date.now() - startTimestamp) / 1000, 0);
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
        const s = get();
        const now = Date.now();

        if (s.mode === "focus") {
          // Skip focus → go to break
          const nextIdx = s.pomodoroIndex + 1;
          const nextMode: "focus" | "short-break" | "long-break" =
            nextIdx % s.totalPomodoros === 0 ? "long-break" : "short-break";
          const secs = modeSecs(nextMode, s.pomodoroLength, s.shortBreak, s.longBreak);
          if (s.state === "running") {
            // Interval keeps running — just update state
            set({ mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs });
          } else {
            clearTick();
            set({ state: "running", mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs });
            _interval = setInterval(() => get().tick(), 500);
          }
        } else {
          // Skip break → go to focus
          const secs = s.pomodoroLength * 60;
          if (s.state === "running") {
            set({ mode: "focus", secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs });
          } else {
            set({ state: "idle", mode: "focus", secondsRemaining: secs, totalSeconds: secs, startTimestamp: null, remainingWhenStarted: secs });
          }
        }
      },

      // ── tick: called every 500 ms while running ──────────────────────────────
      // NEVER clears or restarts the interval from inside here — avoids race conditions.
      // Transitions just update Zustand state; the same interval keeps firing.
      tick: () => {
        const s = get();
        if (s.state !== "running" || s.startTimestamp === null) return;

        const elapsed = (Date.now() - s.startTimestamp) / 1000;
        const newRemaining = s.remainingWhenStarted - elapsed;

        if (newRemaining <= 0) {
          const now = Date.now();

          if (s.mode === "focus") {
            // ── Focus complete → auto-start break ────────────────────────────
            const nextIdx = s.pomodoroIndex + 1;
            const nextMode: "focus" | "short-break" | "long-break" =
              nextIdx % s.totalPomodoros === 0 ? "long-break" : "short-break";
            const secs = modeSecs(nextMode, s.pomodoroLength, s.shortBreak, s.longBreak);
            set({
              mode: nextMode,
              pomodoroIndex: nextIdx,
              secondsRemaining: secs,
              totalSeconds: secs,
              startTimestamp: now,
              remainingWhenStarted: secs,
              // state stays "running" — interval keeps going
            });
          } else {
            // ── Break complete → auto-start next focus ────────────────────────
            const secs = s.pomodoroLength * 60;
            const resetIdx = s.pomodoroIndex % s.totalPomodoros === 0 ? 0 : s.pomodoroIndex;
            set({
              mode: "focus",
              pomodoroIndex: resetIdx,
              secondsRemaining: secs,
              totalSeconds: secs,
              startTimestamp: now,
              remainingWhenStarted: secs,
              // state stays "running"
            });
          }
        } else {
          set({ secondsRemaining: Math.ceil(newRemaining) });
        }
      },

      getSession: () => {
        const s = get();
        return { subjectId: s.selectedSubjectId, subjectName: s.selectedSubjectName, pomodoroIndex: s.pomodoroIndex, totalPomodoros: s.totalPomodoros, secondsRemaining: s.secondsRemaining, totalSeconds: s.totalSeconds, state: s.state, mode: s.mode };
      },
    }),
    {
      name: "studypulse-timer",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      // Called after localStorage is read and state is merged.
      // Flips _hasHydrated so components know real state is now available.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // _hasHydrated and setHasHydrated are intentionally excluded — they must
      // always start as false/undefined on a fresh page load.
      partialize: (s) => ({
        state: s.state, mode: s.mode, secondsRemaining: s.secondsRemaining, totalSeconds: s.totalSeconds,
        pomodoroIndex: s.pomodoroIndex, totalPomodoros: s.totalPomodoros,
        selectedSubjectId: s.selectedSubjectId, selectedSubjectName: s.selectedSubjectName,
        pomodoroLength: s.pomodoroLength, shortBreak: s.shortBreak, longBreak: s.longBreak,
        startTimestamp: s.startTimestamp, remainingWhenStarted: s.remainingWhenStarted,
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
