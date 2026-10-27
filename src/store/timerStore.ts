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

/** A focus that ended (time up, stopped, skipped). TimerSync saves it to the account, then removes it. */
export interface FinishedFocus {
  /** Fixed per focus, so saving twice writes the same document */
  id: string;
  ownerUid: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicTitle: string;
  sessionType: string;
  activeBlockId: string;
  distractions: number;
  plannedSecs: number;
  studiedSecs: number;
  endedAt: number;
}

/** The focus in `s` as a FinishedFocus, if it was really studied (a misclick under a minute is not). */
function finished(s: { mode: string; state: string; totalSeconds: number; secondsRemaining: number; startTimestamp: number | null; remainingWhenStarted: number; focusStartedAt: number | null; ownerUid: string; selectedSubjectId: string; selectedSubjectName: string; selectedTopicId: string; selectedTopicTitle: string; sessionType: string; activeBlockId: string; distractions: number }, timeUp: boolean): FinishedFocus[] {
  if (s.mode !== "focus" || (s.state !== "running" && s.state !== "paused") || !s.selectedSubjectId) return [];
  // The clock only runs while "running", so pauses never count.
  const left = timeUp ? 0 : s.state === "running" && s.startTimestamp !== null
    ? Math.max(0, s.remainingWhenStarted - (Date.now() - s.startTimestamp) / 1000)
    : s.secondsRemaining;
  const studiedSecs = Math.round(Math.max(0, Math.min(s.totalSeconds, s.totalSeconds - left)));
  if (studiedSecs < 59) return [];
  const startedAt = s.focusStartedAt ?? s.startTimestamp ?? Date.now();
  return [{
    id: `focus-${startedAt}`, ownerUid: s.ownerUid, subjectId: s.selectedSubjectId, subjectName: s.selectedSubjectName,
    topicId: s.selectedTopicId, topicTitle: s.selectedTopicTitle, sessionType: s.sessionType, activeBlockId: s.activeBlockId,
    distractions: s.distractions, plannedSecs: s.totalSeconds, studiedSecs, endedAt: Date.now(),
  }];
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

  /** UID of the account this timer state belongs to. Used to detect account switches. */
  ownerUid: string;
  setOwnerUid: (uid: string) => void;

  state: TimerState;
  mode: "focus" | "short-break" | "long-break";
  secondsRemaining: number;
  totalSeconds: number;
  pomodoroIndex: number;
  totalPomodoros: number;
  selectedSubjectId: string;
  selectedSubjectName: string;
  /** Optional topic of the subject ("" = none). Cleared when the subject changes. */
  selectedTopicId: string;
  selectedTopicTitle: string;
  setTopic: (id: string, title: string) => void;
  /** "I got distracted" presses during the current focus */
  distractions: number;
  addDistraction: () => void;
  resetDistractions: () => void;
  sessionType: string;
  setSessionType: (type: string) => void;

  /** Planned study block the running timer belongs to ("" = none). Cleared when the subject changes. */
  activeBlockId: string;
  setActiveBlock: (id: string) => void;
  pomodoroLength: number;
  shortBreak: number;
  longBreak: number;
  startTimestamp: number | null;
  remainingWhenStarted: number;
  /** When the current focus began (ms); stays the same through pauses. Names the saved session, so it is saved once. */
  focusStartedAt: number | null;
  /** Focuses that ended and are not saved yet (kept across reloads) */
  finishedFocuses: FinishedFocus[];
  clearFinished: (id: string) => void;

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

      ownerUid: "",
      setOwnerUid: (uid) => set({ ownerUid: uid }),

      state: "idle",
      mode: "focus",
      secondsRemaining: 25 * 60,
      totalSeconds: 25 * 60,
      pomodoroIndex: 0,
      totalPomodoros: 4,
      selectedSubjectId: "",
      selectedSubjectName: "Select a Subject",
      selectedTopicId: "",
      selectedTopicTitle: "",
      setTopic: (id, title) => set({ selectedTopicId: id, selectedTopicTitle: title }),
      distractions: 0,
      addDistraction: () => set((s) => ({ distractions: s.distractions + 1 })),
      resetDistractions: () => set({ distractions: 0 }),
      sessionType: "Deep Work",
      setSessionType: (type) => set({ sessionType: type }),
      pomodoroLength: 25,
      shortBreak: 5,
      longBreak: 15,
      startTimestamp: null,
      remainingWhenStarted: 25 * 60,
      focusStartedAt: null,
      finishedFocuses: [],
      clearFinished: (id) => set((s) => ({ finishedFocuses: s.finishedFocuses.filter((f) => f.id !== id) })),

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
            set({ finishedFocuses: [...s.finishedFocuses, ...finished(s, true)] }); // ended while the app was closed
            if (timeIntoBreak >= breakSecs) {
              // Break also expired while away — still transition through break so the
              // React effect on the timer page detects focus→break and saves the session.
              // Set 1 s remaining so it ticks to 0 and auto-advances to focus immediately.
              set({ mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: 1, totalSeconds: breakSecs, startTimestamp: now, remainingWhenStarted: 1, focusStartedAt: null });
            } else {
              const breakRemaining = breakSecs - timeIntoBreak;
              set({ mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: Math.ceil(breakRemaining), totalSeconds: breakSecs, startTimestamp: now, remainingWhenStarted: Math.ceil(breakRemaining), focusStartedAt: null });
            }
          } else {
            const secs = s.pomodoroLength * 60;
            const now = Date.now();
            // Reset index when coming back from a long-break (matching tick() behaviour)
            const resetIdx = s.pomodoroIndex % s.totalPomodoros === 0 ? 0 : s.pomodoroIndex;
            set({ mode: "focus", pomodoroIndex: resetIdx, secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs, focusStartedAt: now });
          }
        } else {
          set({ secondsRemaining: Math.ceil(actualRemaining) });
        }

        // Restart the single interval
        _interval = setInterval(() => get().tick(), 500);
      },

      setSubject: (id, name) => set((s) => ({ selectedSubjectId: id, selectedSubjectName: name, ...(id !== s.selectedSubjectId ? { activeBlockId: "", selectedTopicId: "", selectedTopicTitle: "" } : {}) })),
      activeBlockId: "",
      setActiveBlock: (id) => set({ activeBlockId: id }),

      setDurations: (focus, shortB, longB) => {
        clearTick();
        set((s) => ({ finishedFocuses: [...s.finishedFocuses, ...finished(s, false)] })); // stopped early: keep the time studied
        const secs = focus * 60;
        set({ pomodoroLength: focus, shortBreak: shortB, longBreak: longB, secondsRemaining: secs, totalSeconds: secs, state: "idle", mode: "focus", pomodoroIndex: 0, startTimestamp: null, remainingWhenStarted: secs, focusStartedAt: null });
      },

      setTotalPomodoros: (n) => {
        clearTick();
        set((s) => ({ finishedFocuses: [...s.finishedFocuses, ...finished(s, false)] })); // stopped early: keep the time studied
        const secs = get().pomodoroLength * 60;
        set({ totalPomodoros: n, pomodoroIndex: 0, state: "idle", mode: "focus", secondsRemaining: secs, totalSeconds: secs, startTimestamp: null, remainingWhenStarted: secs, focusStartedAt: null });
      },

      setPreset: (minutes) => {
        clearTick();
        set((s) => ({ finishedFocuses: [...s.finishedFocuses, ...finished(s, false)] })); // stopped early: keep the time studied
        set({ pomodoroLength: minutes, secondsRemaining: minutes * 60, totalSeconds: minutes * 60, state: "idle", mode: "focus", pomodoroIndex: 0, startTimestamp: null, remainingWhenStarted: minutes * 60, focusStartedAt: null });
      },

      // User presses play once — interval runs until paused/reset
      start: () => {
        const s = get();
        if (s.state === "running") return;
        if (!s.selectedSubjectId) return;
        clearTick();
        const now = Date.now();
        set({ state: "running", startTimestamp: now, remainingWhenStarted: s.secondsRemaining, ...(s.mode === "focus" && !s.focusStartedAt ? { focusStartedAt: now } : {}) });
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
        set((s) => ({ finishedFocuses: [...s.finishedFocuses, ...finished(s, false)] })); // stopped early: keep the time studied
        const { mode, pomodoroLength, shortBreak, longBreak } = get();
        const secs = modeSecs(mode, pomodoroLength, shortBreak, longBreak);
        set({ state: "idle", secondsRemaining: secs, totalSeconds: secs, startTimestamp: null, remainingWhenStarted: secs, focusStartedAt: null });
      },

      skip: () => {
        const s = get();
        const now = Date.now();

        if (s.mode === "focus") {
          set({ finishedFocuses: [...s.finishedFocuses, ...finished(s, false)] });
          // Skip focus → go to break
          const nextIdx = s.pomodoroIndex + 1;
          const nextMode: "focus" | "short-break" | "long-break" =
            nextIdx % s.totalPomodoros === 0 ? "long-break" : "short-break";
          const secs = modeSecs(nextMode, s.pomodoroLength, s.shortBreak, s.longBreak);
          if (s.state === "running") {
            // Interval keeps running — just update state
            set({ mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs, focusStartedAt: null });
          } else {
            clearTick();
            set({ state: "running", mode: nextMode, pomodoroIndex: nextIdx, secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs, focusStartedAt: null });
            _interval = setInterval(() => get().tick(), 500);
          }
        } else {
          // Skip break → go to focus
          const secs = s.pomodoroLength * 60;
          if (s.state === "running") {
            set({ mode: "focus", secondsRemaining: secs, totalSeconds: secs, startTimestamp: now, remainingWhenStarted: secs, focusStartedAt: now });
          } else {
            set({ state: "idle", mode: "focus", secondsRemaining: secs, totalSeconds: secs, startTimestamp: null, remainingWhenStarted: secs, focusStartedAt: null });
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
            set({ finishedFocuses: [...s.finishedFocuses, ...finished(s, true)] });
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
              focusStartedAt: null,
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
              focusStartedAt: now,
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
        // Old builds stored "Select a Focus Area" as the empty-subject label.
        if (state?.selectedSubjectName === "Select a Focus Area") state.setSubject(state.selectedSubjectId, "Select a Subject");
        state?.setHasHydrated(true);
      },
      // _hasHydrated and setHasHydrated are intentionally excluded — they must
      // always start as false/undefined on a fresh page load.
      partialize: (s) => ({
        ownerUid: s.ownerUid,
        state: s.state, mode: s.mode, secondsRemaining: s.secondsRemaining, totalSeconds: s.totalSeconds,
        pomodoroIndex: s.pomodoroIndex, totalPomodoros: s.totalPomodoros,
        selectedSubjectId: s.selectedSubjectId, selectedSubjectName: s.selectedSubjectName,
        selectedTopicId: s.selectedTopicId, selectedTopicTitle: s.selectedTopicTitle,
        distractions: s.distractions,
        sessionType: s.sessionType,
        activeBlockId: s.activeBlockId,
        pomodoroLength: s.pomodoroLength, shortBreak: s.shortBreak, longBreak: s.longBreak,
        startTimestamp: s.startTimestamp, remainingWhenStarted: s.remainingWhenStarted,
        focusStartedAt: s.focusStartedAt,
        finishedFocuses: s.finishedFocuses,
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
