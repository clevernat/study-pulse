"use client";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "./useCollection";
import { useStudyTargets } from "./useStudyTargets";
import { saveProgress } from "./members";
import { buildProgress } from "@/lib/progress";
import { localDateStr } from "@/lib/dateUtils";
import type { Exam, Goal, Session, Subject, TestResult, Topic } from "@/types";

const REFRESH_MS = 6 * 3_600_000; // rewrite at least this often, so admins see "last opened"

/** Keeps progress/{uid} (the summary admins see) in step with the member's data. */
export function useProgressSync() {
  const { user, member } = useAuth();
  const sessions = useCollection<Session>("sessions");
  const subjects = useCollection<Subject>("subjects");
  const goals = useCollection<Goal>("goals");
  const exams = useCollection<Exam>("exams");
  const results = useCollection<TestResult>("results");
  const topics = useCollection<Topic>("topics");
  const target = useStudyTargets();
  const last = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  const ready = !!user && !!member && target.loaded && ![sessions, subjects, goals, exams, results, topics].some((c) => c.loading);
  const today = localDateStr();
  const summary = useMemo(() => ready ? buildProgress({
    name: member!.name, email: member!.email,
    sessions: sessions.items, subjects: subjects.items, goals: goals.items, exams: exams.items, results: results.items, topics: topics.items,
    target: { daily: target.daily, weekly: target.weekly },
  }, today, 0) : null,
  [ready, member, sessions.items, subjects.items, goals.items, exams.items, results.items, topics.items, target.daily, target.weekly, today]);

  useEffect(() => {
    if (!summary || !user) return;
    const key = JSON.stringify(summary);
    const storeKey = `sp-progress-${user.uid}`;
    if (!last.current.key) {
      try { last.current = JSON.parse(localStorage.getItem(storeKey) ?? "") ?? last.current; } catch { /* first time on this device */ }
    }
    const now = Date.now();
    if (key === last.current.key && now - last.current.at < REFRESH_MS) return;
    const t = setTimeout(() => {
      last.current = { key, at: now };
      try { localStorage.setItem(storeKey, JSON.stringify(last.current)); } catch { /* private mode */ }
      saveProgress(user.uid, { ...summary, updatedAt: now });
    }, 3000); // wait for a burst of changes to settle
    return () => clearTimeout(t);
  }, [summary, user]);
}
