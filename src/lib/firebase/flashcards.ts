import { collection, doc, getDocs, query, where, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "./config";
import { queue, addSession } from "./firestore";
import { cardOrds } from "@/lib/flashcards/cloze";
import { newCardFields, type SchedFields } from "@/lib/flashcards/scheduler";
import { localDateStr } from "@/lib/dateUtils";
import type { Card, Deck, Note, ReviewLogDoc, Subject } from "@/types";

const col = (uid: string, name: string) => collection(db, "users", uid, name);

// Firestore allows 500 writes per batch; stay below it.
const BATCH_LIMIT = 450;

/** Runs `fill` for each item, committing a new batch every BATCH_LIMIT writes. */
async function inBatches<T>(items: T[], writesPerItem: number, fill: (b: WriteBatch, item: T) => void, onProgress?: (done: number) => void) {
  const per = Math.max(1, Math.floor(BATCH_LIMIT / writesPerItem));
  for (let i = 0; i < items.length; i += per) {
    const b = writeBatch(db);
    items.slice(i, i + per).forEach((item) => fill(b, item));
    await queue(b.commit());
    onProgress?.(Math.min(items.length, i + per));
  }
}

function newCard(note: Pick<Note, "deckId">, noteId: string, ord: number, now: Date): Omit<Card, "id"> {
  return { noteId, deckId: note.deckId, ord, ...newCardFields(now), suspended: false, buriedUntil: null, createdAt: now.getTime() };
}

export const DEFAULT_DECK = { newPerDay: 20, reviewsPerDay: 200, retention: 0.9 };

/** Adds notes and one card per card number. Returns the number of cards made. */
export async function addNotes(uid: string, notes: Omit<Note, "id" | "createdAt">[], onProgress?: (done: number) => void): Promise<number> {
  const now = Date.now();
  let made = 0;
  const prepared = notes.map((n, i) => ({ note: { ...n, createdAt: now + i }, ords: cardOrds(n.type, n.fields) })).filter((p) => p.ords.length > 0);
  const maxWrites = 1 + Math.max(1, ...prepared.map((p) => p.ords.length));
  await inBatches(prepared, maxWrites, (b, { note, ords }) => {
    const ref = doc(col(uid, "notes"));
    b.set(ref, note);
    for (const ord of ords) { b.set(doc(col(uid, "cards")), newCard(note, ref.id, ord, new Date(note.createdAt))); made++; }
  }, onProgress);
  return made;
}

/** Saves edited fields; adds cards for new cloze numbers and removes cards whose number is gone. */
export async function updateNote(uid: string, note: Note, fields: Note["fields"], tags: string[], cards: Card[]): Promise<void> {
  const want = new Set(cardOrds(note.type, fields));
  const have = cards.filter((c) => c.noteId === note.id);
  const b = writeBatch(db);
  b.update(doc(db, "users", uid, "notes", note.id), { fields, tags });
  for (const c of have) if (!want.has(c.ord)) b.delete(doc(db, "users", uid, "cards", c.id));
  const haveOrds = new Set(have.map((c) => c.ord));
  for (const ord of want) if (!haveOrds.has(ord)) b.set(doc(col(uid, "cards")), newCard(note, note.id, ord, new Date()));
  await queue(b.commit());
}

export async function deleteNote(uid: string, noteId: string): Promise<void> {
  const cards = await getDocs(query(col(uid, "cards"), where("noteId", "==", noteId)));
  const b = writeBatch(db);
  cards.docs.forEach((d) => b.delete(d.ref));
  b.delete(doc(db, "users", uid, "notes", noteId));
  await queue(b.commit());
}

/** Deletes a deck with its notes, cards and review history. */
export async function deleteDeck(uid: string, deckId: string): Promise<void> {
  const snaps = await Promise.all(["cards", "notes", "reviewLogs"].map((c) => getDocs(query(col(uid, c), where("deckId", "==", deckId)))));
  await inBatches(snaps.flatMap((s) => s.docs), 1, (b, d) => b.delete(d.ref));
  await queue(writeBatch(db).delete(doc(db, "users", uid, "decks", deckId)).commit());
}

/** Saves an answer: new card fields + one review log entry. Returns the log id (for undo). */
export async function saveAnswer(uid: string, cardId: string, fields: Partial<Card>, log: Omit<ReviewLogDoc, "id">): Promise<string> {
  const b = writeBatch(db);
  const logRef = doc(col(uid, "reviewLogs"));
  b.update(doc(db, "users", uid, "cards", cardId), fields);
  b.set(logRef, log);
  await queue(b.commit());
  return logRef.id;
}

/** Undo: puts the card back as it was and removes the review log entry. */
export async function undoAnswer(uid: string, cardId: string, before: SchedFields & Pick<Card, "suspended">, logId: string): Promise<void> {
  const b = writeBatch(db);
  b.update(doc(db, "users", uid, "cards", cardId), { ...before });
  b.delete(doc(db, "users", uid, "reviewLogs", logId));
  await queue(b.commit());
}

/** Review time is saved as a normal study session, so it counts in streaks, goals and reports. */
export async function saveReviewSession(uid: string, deck: Deck, subject: Subject | undefined, answers: number, totalMs: number, startedAt: Date): Promise<string> {
  const end = new Date();
  return addSession(uid, {
    uid,
    subjectId: deck.subjectId,
    subjectName: subject?.name ?? deck.name,
    subjectColor: subject?.color ?? "violet",
    durationMinutes: Math.max(1, Math.round(totalMs / 60_000)),
    focusScore: 100,
    pomodoroCount: 0,
    sessionType: "Flashcards",
    deckId: deck.id,
    reviewCount: answers,
    notes: `${answers} flashcard${answers === 1 ? "" : "s"} reviewed in ${deck.name}`,
    date: localDateStr(startedAt),
    startTime: startedAt.toTimeString().slice(0, 5),
    endTime: end.toTimeString().slice(0, 5),
  });
}
