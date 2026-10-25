"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { saveUserPreferences, subscribeUserPreferences } from "./firestore";

/** Daily and weekly study targets in minutes (0 = none), synced with the account. */
export function useStudyTargets() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<{ daily: number; weekly: number; loaded: boolean }>({ daily: 0, weekly: 0, loaded: false });
  useEffect(() => {
    if (!user) return;
    return subscribeUserPreferences(user.uid, (p) =>
      setTargets({ daily: p?.dailyTargetMinutes ?? 0, weekly: p?.weeklyTargetMinutes ?? 0, loaded: true }));
  }, [user]);
  const save = (daily: number, weekly: number) =>
    user ? saveUserPreferences(user.uid, { dailyTargetMinutes: daily, weeklyTargetMinutes: weekly }) : Promise.resolve();
  return { ...targets, save };
}
