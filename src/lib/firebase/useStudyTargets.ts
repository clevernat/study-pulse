"use client";
import { useCollection } from "./useCollection";
import type { Subject } from "@/types";

/**
 * Daily and weekly study targets in minutes (0 = none). Every target belongs to a
 * subject (saved on the subject); the total is the sum over all subjects.
 */
export function useStudyTargets() {
  const { items: subjects, loading } = useCollection<Subject>("subjects");
  return {
    daily: subjects.reduce((n, s) => n + (s.dailyTargetMinutes ?? 0), 0),
    weekly: subjects.reduce((n, s) => n + (s.weeklyTargetMinutes ?? 0), 0),
    loaded: !loading,
  };
}
