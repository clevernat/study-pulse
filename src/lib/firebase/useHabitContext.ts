"use client";
import { useMemo } from "react";
import { useCollection } from "./useCollection";
import { useReviewDays } from "./useFlashcards";
import { buildContext } from "@/lib/habits";
import { localDateStr } from "@/lib/dateUtils";
import type { Session } from "@/types";

/** Daily study minutes and reviewed cards, for automatic habits. */
export function useHabitContext() {
  const { items: sessions } = useCollection<Session>("sessions");
  const { items: days } = useReviewDays();
  return useMemo(() => {
    const ctx = buildContext(sessions, [], (ms) => localDateStr(new Date(ms)));
    for (const d of days) ctx.cardsReviewed[d.id] = d.count ?? 0;
    return ctx;
  }, [sessions, days]);
}
