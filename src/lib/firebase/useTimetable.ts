"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeDocument, saveDocument } from "./firestore";
import { DEFAULT_TIMETABLE } from "@/lib/timetable";
import type { TimetableSettings } from "@/types";

/** Term, rotation and holidays (users/{uid}/preferences/timetable). */
export function useTimetable() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TimetableSettings>(DEFAULT_TIMETABLE);
  useEffect(() => {
    if (!user) return;
    return subscribeDocument<TimetableSettings>(user.uid, "preferences", "timetable", (d) =>
      setSettings({ ...DEFAULT_TIMETABLE, ...(d ?? {}) }));
  }, [user]);
  const save = (next: TimetableSettings) => (user ? saveDocument(user.uid, "preferences", "timetable", next) : Promise.resolve());
  return { settings, save };
}
