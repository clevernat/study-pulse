"use client";
import { create } from "zustand";
import type { TimerState, TimerSession } from "@/types";

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
  intervalRef: ReturnType<typeof setInterval> | null;

  // Actions
  setSubject: (id: string, name: string) => void;
  setPreset: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  getSession: () => TimerSession;
}

function modeSeconds(mode: string, focus: number, shortB: number, longB: number): number {
  if (mode === "short-break") return shortB * 60;
  if (mode === "long-break") return longB * 60;
  return focus * 60;
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
  intervalRef: null,

  setSubject: (id, name) => set({ selectedSubjectId: id, selectedSubjectName: name }),

  setPreset: (minutes) => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    set({
      pomodoroLength: minutes,
      secondsRemaining: minutes * 60,
      totalSeconds: minutes * 60,
      state: "idle",
      mode: "focus",
      pomodoroIndex: 0,
      intervalRef: null,
    });
  },

  start: () => {
    const { state, tick, intervalRef } = get();
    if (state === "running") return;
    if (intervalRef) clearInterval(intervalRef);
    const ref = setInterval(tick, 1000);
    set({ state: "running", intervalRef: ref });
  },

  pause: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    set({ state: "paused", intervalRef: null });
  },

  reset: () => {
    const { intervalRef, mode, pomodoroLength, shortBreak, longBreak } = get();
    if (intervalRef) clearInterval(intervalRef);
    const secs = modeSeconds(mode, pomodoroLength, shortBreak, longBreak);
    set({ state: "idle", secondsRemaining: secs, totalSeconds: secs, intervalRef: null });
  },

  skip: () => {
    const { intervalRef, pomodoroIndex, totalPomodoros, pomodoroLength, shortBreak, longBreak } = get();
    if (intervalRef) clearInterval(intervalRef);
    const nextIndex = pomodoroIndex + 1;
    const nextMode: "focus" | "short-break" | "long-break" =
      nextIndex % totalPomodoros === 0 ? "long-break" : "short-break";
    const secs = modeSeconds(nextMode, pomodoroLength, shortBreak, longBreak);
    set({ state: "break", mode: nextMode, pomodoroIndex: nextIndex, secondsRemaining: secs, totalSeconds: secs, intervalRef: null });
  },

  tick: () => {
    const { secondsRemaining, pomodoroIndex, totalPomodoros, pomodoroLength, shortBreak, longBreak, intervalRef } = get();
    if (secondsRemaining <= 1) {
      if (intervalRef) clearInterval(intervalRef);
      const nextIndex = pomodoroIndex + 1;
      const nextMode: "focus" | "short-break" | "long-break" =
        nextIndex % totalPomodoros === 0 ? "long-break" : "short-break";
      const secs = modeSeconds(nextMode, pomodoroLength, shortBreak, longBreak);
      set({ secondsRemaining: secs, totalSeconds: secs, state: "break", mode: nextMode, pomodoroIndex: nextIndex, intervalRef: null });
    } else {
      set((s) => ({ secondsRemaining: s.secondsRemaining - 1 }));
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
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
