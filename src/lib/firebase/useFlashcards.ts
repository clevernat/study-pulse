"use client";
import { useMemo } from "react";
import { useCollection } from "./useCollection";
import { dayBounds } from "@/lib/flashcards/queue";
import type { Card, Deck, Note, ReviewLogDoc } from "@/types";

// ponytail: loads every card and review of the user (fine for a few thousand
// cards); query per deck / by due date if collections grow much larger.
export function useFlashcards() {
  const decks = useCollection<Deck>("decks");
  const notes = useCollection<Note>("notes");
  const cards = useCollection<Card>("cards");
  const logs = useCollection<ReviewLogDoc>("reviewLogs");
  const { start } = dayBounds(new Date());
  const logsToday = useMemo(() => logs.items.filter((l) => l.review >= start), [logs.items, start]);
  return {
    uid: decks.uid,
    loading: decks.loading || cards.loading,
    decks: decks.items.sort((a, b) => a.name.localeCompare(b.name)),
    notes: notes.items,
    cards: cards.items,
    logs: logs.items,
    logsToday,
  };
}
