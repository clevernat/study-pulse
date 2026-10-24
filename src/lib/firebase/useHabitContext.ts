"use client";
import { useMemo } from "react";
import { useCollection } from "./useCollection";
import { buildContext } from "@/lib/habits";
import { localDateStr } from "@/lib/dateUtils";
import type { Session } from "@/types";

/** Daily study minutes and reviewed cards, for automatic habits. */
export function useHabitContext() {
  const { items: sessions } = useCollection<Session>("sessions");
  const { items: reviews } = useCollection<{ id: string; review: number }>("reviewLogs");
  return useMemo(() => buildContext(sessions, reviews, (ms) => localDateStr(new Date(ms))), [sessions, reviews]);
}
