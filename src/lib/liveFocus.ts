"use client";
// The focus that is running right now counts as study time straight away,
// before it is saved as a session (that happens when the focus ends or stops).
import { useMemo } from "react";
import { useTimerStore } from "@/store/timerStore";
import { localDateStr } from "@/lib/dateUtils";
import type { Session } from "@/types";

export const LIVE_SESSION_ID = "__live";

/** Whole minutes of the current focus (re-renders once a minute, not every second). */
export function useLiveFocus() {
  const minutes = useTimerStore((s) => (s.mode === "focus" && (s.state === "running" || s.state === "paused") ? Math.floor(Math.max(0, s.totalSeconds - s.secondsRemaining) / 60) : -1));
  const subjectId = useTimerStore((s) => s.selectedSubjectId);
  const subjectName = useTimerStore((s) => s.selectedSubjectName);
  const topicId = useTimerStore((s) => s.selectedTopicId);
  const topicTitle = useTimerStore((s) => s.selectedTopicTitle);
  return { active: minutes >= 0 && !!subjectId, minutes: Math.max(0, minutes), subjectId, subjectName, topicId, topicTitle };
}

/** `sessions` plus the running focus as an unsaved session, so totals, goals and targets move live. */
export function withLive(sessions: Session[], live: ReturnType<typeof useLiveFocus>, now = new Date()): Session[] {
  if (!live.active || live.minutes < 1) return sessions;
  const start = new Date(now.getTime() - live.minutes * 60_000);
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return [...sessions, {
    id: LIVE_SESSION_ID, uid: "", subjectId: live.subjectId, subjectName: live.subjectName, subjectColor: "",
    topicId: live.topicId || undefined, topicTitle: live.topicTitle || undefined,
    durationMinutes: live.minutes, focusScore: 100, pomodoroCount: 0,
    date: localDateStr(now), startTime: hhmm(start), endTime: hhmm(now),
  }];
}

/** The usual hook: sessions with the running focus included. */
export function useLiveSessions(sessions: Session[]): Session[] {
  const live = useLiveFocus();
  return useMemo(() => withLive(sessions, live), [sessions, live.active, live.minutes, live.subjectId, live.topicId]); // eslint-disable-line react-hooks/exhaustive-deps
}
