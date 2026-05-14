"use client";
import { create } from "zustand";
import type { TimerState, TimerSession } from "@/types";

// Module-level interval so React lifecycle can't interfere with it
let _interval: ReturnType<typeof setInterval> | null = null;

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
  // Clock-based timing — immune to tab throttling
  startTimestamp: number | null;
  remainingWhenStarted: number;

  setSubject: (id: string, name: string) => void;
  setPreset: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  getSession: () => TimerSession;
}

function modeSecs(mode: string, focus: number, shortB: number, longB: number): number {
  if (mode === "short-break") return shortB * 60;
  if (mode === "long-break") return longB * 60;
  return focus * 60;
}

function clearTick() {
  if (_interval !== null) {
    clearInterval(_interval);
    _interval = null;
  }
}

export const useTimerStore = create<TimerStore>((set, get) => ({
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

  setSubject: (id, name) => set({ selectedSubjectId: id, selectedSubjectName: name }),

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
    const { state, secondsRemaining } = get();
    if (state === "running") return;
    clearTick();
    const now = Date.now();
    set({ state: "running", startTimestamp: now, remainingWhenStarted: secondsRemaining });
    _interval = setInterval(() => get().tick(), 250); // 250ms for smooth updates
  },

  pause: () => {
    const { startTimestamp, remainingWhenStarted } = get();
    clearTick();
    // Compute accurate remaining time from the wall clock
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
}));

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
