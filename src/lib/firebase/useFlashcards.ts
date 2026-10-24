"use client";
// Flashcard data with small, bounded reads (the free Firestore plan allows
// 50,000 document reads per day). Screens never load every card or review:
// - cards due today (learning + review) and a few new cards per deck,
// - today's review log (for daily limits),
// - one small summary document per day (reviewDays) for stats and habits,
// - count queries (1 read per 1,000 cards) for totals.
import { useEffect, useMemo, useState } from "react";
import {
  collection, documentId, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, where,
  type Query, type QueryConstraint,
} from "firebase/firestore";
import { db } from "./config";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "./useCollection";
import { dayBounds } from "@/lib/flashcards/queue";
import { localDateStr } from "@/lib/dateUtils";
import type { Card, Deck, Note, ReviewDay, ReviewLogDoc } from "@/types";

const col = (uid: string, name: string) => collection(db, "users", uid, name);
const LEARNING_OR_REVIEW = [1, 2, 3];

/** Live results of one query. `key` changes when the query changes (null = no query). */
export function useLiveQuery<T extends { id: string }>(key: string | null, make: (uid: string) => Query) {
  const { user } = useAuth();
  const [state, setState] = useState<{ key: string | null; items: T[] }>({ key: null, items: [] });
  useEffect(() => {
    if (!user || key === null) return;
    return onSnapshot(make(user.uid), (snap) => setState({ key, items: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T) }),
      (err) => console.error(`Query ${key} failed:`, err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key]);
  return { items: state.key === key ? state.items : [], loading: !!user && key !== null && state.key !== key, uid: user?.uid ?? "" };
}

/** New cards of each deck, oldest first: a few more than the daily limit (some may be hidden or siblings). */
function useNewCards(decks: Deck[]) {
  const { user } = useAuth();
  const spec = decks.map((d) => `${d.id}:${newFetchLimit(d)}`).join(",");
  const [byDeck, setByDeck] = useState<Record<string, Card[]>>({});
  useEffect(() => {
    if (!user) return;
    const unsubs = decks.map((d) => onSnapshot(
      query(col(user.uid, "cards"), where("deckId", "==", d.id), where("state", "==", 0), orderBy("createdAt"), limit(newFetchLimit(d))),
      (snap) => setByDeck((m) => ({ ...m, [d.id]: snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Card) })),
      (err) => console.error("New cards query failed:", err)));
    return () => unsubs.forEach((u) => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, spec]);
  return useMemo(() => decks.flatMap((d) => byDeck[d.id] ?? []), [decks, byDeck]);
}

// ponytail: if many of the oldest new cards are suspended or buried, fewer than
// the daily limit may show; raise the factor if that happens in practice.
const newFetchLimit = (d: Deck) => Math.min(500, Math.max(10, d.newPerDay * 4));

/** Everything the study screens need: decks, today's study cards and today's answers. */
export function useStudyCards() {
  const decks = useCollection<Deck>("decks");
  const today = localDateStr();
  const { start, end } = dayBounds(new Date());
  const due = useLiveQuery<Card>(`due:${today}`, (uid) =>
    query(col(uid, "cards"), where("state", "in", LEARNING_OR_REVIEW), where("due", "<", end)));
  const logs = useLiveQuery<ReviewLogDoc>(`logs:${today}`, (uid) => query(col(uid, "reviewLogs"), where("review", ">=", start)));
  const sortedDecks = useMemo(() => [...decks.items].sort((a, b) => a.name.localeCompare(b.name)), [decks.items]);
  const fresh = useNewCards(sortedDecks);
  const cards = useMemo(() => [...due.items, ...fresh], [due.items, fresh]);
  return { uid: decks.uid, loading: decks.loading || due.loading, decks: sortedDecks, cards, logsToday: logs.items };
}

/** Cards in learning/review that come due before now + `days` (reminders, forecast). */
export function useComingCards(days: number) {
  const until = dayBounds(new Date()).start + days * 86_400_000;
  return useLiveQuery<Card>(`coming:${days}:${until}`, (uid) =>
    query(col(uid, "cards"), where("state", "in", LEARNING_OR_REVIEW), where("due", "<", until)));
}

/** All day summaries (one small document per study day). */
export function useReviewDays() {
  return useCollection<ReviewDay>("reviewDays");
}

/** Notes by id, fetched in groups of 30 (Firestore's "in" limit) and kept in memory. */
export function useNotesByIds(ids: string[]) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const missing = ids.filter((id) => !notes[id]).join(",");
  useEffect(() => {
    if (!user || !missing) return;
    const list = missing.split(",");
    Promise.all(Array.from({ length: Math.ceil(list.length / 30) }, (_, i) =>
      getDocs(query(col(user.uid, "notes"), where(documentId(), "in", list.slice(i * 30, i * 30 + 30))))))
      .then((snaps) => setNotes((m) => {
        const next = { ...m };
        for (const s of snaps) for (const d of s.docs) next[d.id] = { id: d.id, ...d.data() } as Note;
        return next;
      }))
      .catch((err) => console.error("Loading notes failed:", err));
  }, [user, missing]);
  return notes;
}

export const DECK_NOTES_LIMIT = 300;

/** The newest notes of a deck (for browsing) and their cards. */
export function useDeckNotes(deckId: string) {
  const notes = useLiveQuery<Note>(deckId ? `notes:${deckId}` : null, (uid) =>
    query(col(uid, "notes"), where("deckId", "==", deckId), orderBy("createdAt", "desc"), limit(DECK_NOTES_LIMIT)));
  const { user } = useAuth();
  const ids = notes.items.map((n) => n.id);
  const idKey = ids.join(",");
  const [cards, setCards] = useState<Record<number, Card[]>>({});
  useEffect(() => {
    if (!user || ids.length === 0) { setCards({}); return; }
    const unsubs = Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => onSnapshot(
      query(col(user.uid, "cards"), where("noteId", "in", ids.slice(i * 30, i * 30 + 30))),
      (snap) => setCards((m) => ({ ...m, [i]: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Card) })),
      (err) => console.error("Deck cards query failed:", err)));
    return () => unsubs.forEach((u) => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, idKey]);
  return { notes: notes.items, cards: useMemo(() => Object.values(cards).flat(), [cards]), loading: notes.loading };
}

/** Number of cards (count query: 1 read per 1,000 cards). `where` adds filters, e.g. a deck. */
export async function countCards(uid: string, ...filters: QueryConstraint[]): Promise<number> {
  const snap = await getCountFromServer(query(col(uid, "cards"), ...filters));
  return snap.data().count;
}

/** Card totals per deck, refreshed when `refreshKey` changes. */
export function useDeckTotals(deckIds: string[], refreshKey: string | number = "") {
  const { user } = useAuth();
  const [totals, setTotals] = useState<Record<string, number>>({});
  const idKey = deckIds.join(",");
  useEffect(() => {
    if (!user) return;
    Promise.all(deckIds.map(async (id) => [id, await countCards(user.uid, where("deckId", "==", id))] as const))
      .then((pairs) => setTotals(Object.fromEntries(pairs)))
      .catch((err) => console.error("Counting cards failed:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, idKey, refreshKey]);
  return totals;
}
