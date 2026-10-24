"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStudyCards, useNotesByIds } from "@/lib/firebase/useFlashcards";
import { dayDelta, negate, type DayDelta } from "@/lib/flashcards/reviewDays";
import { useCollection } from "@/lib/firebase/useCollection";
import { updateItem, linkSessionToBlock } from "@/lib/firebase/firestore";
import { saveAnswer, undoAnswer, saveReviewSession } from "@/lib/firebase/flashcards";
import { buildQueue, LEARN_AHEAD_MS } from "@/lib/flashcards/queue";
import { answerCard, previewIntervals, ANSWERS, type Answer, type SchedFields } from "@/lib/flashcards/scheduler";
import { cardSides } from "@/lib/flashcards/cloze";
import { localDateStr, daysAgoStr } from "@/lib/dateUtils";
import CardHtml from "@/components/flashcards/CardHtml";
import { primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import type { Card, Subject } from "@/types";

const BUTTON_STYLE: Record<number, string> = {
  1: "bg-error/15 text-error border-error/40",
  2: "bg-tertiary/10 text-tertiary border-tertiary/40",
  3: "bg-secondary/10 text-secondary border-secondary/40",
  4: "bg-primary/15 text-primary border-primary/40",
};

interface UndoItem { cardId: string; deckId: string; before: SchedFields & Pick<Card, "suspended">; logId: string; durationMs: number; day: string; delta: DayDelta }
interface Tally { answers: number; ms: number }

function pickSched(c: Card): SchedFields & Pick<Card, "suspended"> {
  const { due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, suspended } = c;
  return { due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, suspended };
}

function Review() {
  const params = useSearchParams();
  const deckParam = params.get("deck");
  const blockParam = params.get("block");
  const { uid, decks, cards, logsToday, loading } = useStudyCards();
  const { items: subjects } = useCollection<Subject>("subjects");

  const [now, setNow] = useState(() => Date.now());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [waiting, setWaiting] = useState<{ id: string; reps: number } | null>(null);
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [savedMsg, setSavedMsg] = useState("");
  const shownAt = useRef(Date.now());
  const startedAt = useRef<Date | null>(null);
  const tally = useRef<Record<string, Tally>>({});

  // Re-check every 15 s so learning cards appear when they are due.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);

  const activeDecks = useMemo(() => (deckParam ? decks.filter((d) => d.id === deckParam) : decks), [decks, deckParam]);
  const today = localDateStr(new Date(now));
  // A card just answered stays hidden until its new state arrives (prevents a double answer).
  const visibleCards = waiting ? cards.filter((c) => !(c.id === waiting.id && c.reps === waiting.reps)) : cards;
  let queue = buildQueue(visibleCards, activeDecks, logsToday, new Date(now), today);
  if (queue.cards.length === 0) queue = buildQueue(visibleCards, activeDecks, logsToday, new Date(now), today, LEARN_AHEAD_MS);
  const current = queue.cards.find((c) => c.id === currentId) ?? queue.cards[0];
  const deck = decks.find((d) => d.id === current?.deckId);
  // Load the notes of the next cards only (not every note).
  const notesById = useNotesByIds(queue.cards.slice(0, 20).map((c) => c.noteId));
  const note = current ? notesById[current.noteId] : undefined;

  useEffect(() => {
    if (current && current.id !== currentId) { setCurrentId(current.id); setShowAnswer(false); }
    if (current) shownAt.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => { if (waiting && !cards.some((c) => c.id === waiting.id && c.reps === waiting.reps)) setWaiting(null); }, [cards, waiting]);

  /** Saves the review time as study sessions (one per deck). */
  const saveSessions = useCallback(async () => {
    const entries = Object.entries(tally.current).filter(([, t]) => t.answers > 0);
    if (!uid || entries.length === 0 || !startedAt.current) return "";
    const started = startedAt.current;
    tally.current = {};
    startedAt.current = null;
    let minutes = 0, answers = 0;
    for (const [deckId, t] of entries) {
      const d = decks.find((x) => x.id === deckId);
      if (!d) continue;
      const id = await saveReviewSession(uid, d, subjects.find((s) => s.id === d.subjectId), t.answers, t.ms, started);
      if (blockParam) linkSessionToBlock(uid, blockParam, id, Math.max(1, Math.round(t.ms / 60_000))).catch(() => undefined);
      minutes += Math.max(1, Math.round(t.ms / 60_000));
      answers += t.answers;
    }
    return `Saved ${answers} answer${answers === 1 ? "" : "s"} as ${minutes} min of study.`;
  }, [uid, decks, subjects, blockParam]);

  // Leaving the page also saves the review time.
  const saveRef = useRef(saveSessions);
  saveRef.current = saveSessions;
  useEffect(() => () => { saveRef.current(); }, []);

  const finished = !loading && !current;
  useEffect(() => {
    if (finished && Object.keys(tally.current).length > 0) saveSessions().then((m) => m && setSavedMsg(m));
  }, [finished, saveSessions]);

  const answer = useCallback(async (rating: Answer) => {
    if (!current || !uid) return;
    const durationMs = Date.now() - shownAt.current;
    const result = answerCard(current, rating, new Date(), deck, durationMs);
    setWaiting({ id: current.id, reps: current.reps });
    setShowAnswer(false);
    startedAt.current ??= new Date(Date.now() - result.log.durationMs);
    const t = (tally.current[current.deckId] ??= { answers: 0, ms: 0 });
    t.answers++; t.ms += result.log.durationMs;
    setSavedMsg("");
    const day = localDateStr(new Date(result.log.review));
    const delta = dayDelta(current, rating, result.log.durationMs, logsToday);
    const logId = await saveAnswer(uid, current.id, result.fields, result.log, day, delta);
    setUndoStack((s) => [...s.slice(-19), { cardId: current.id, deckId: current.deckId, before: pickSched(current), logId, durationMs: result.log.durationMs, day, delta }]);
  }, [current, uid, deck, logsToday]);

  const undo = useCallback(async () => {
    const last = undoStack.at(-1);
    if (!last || !uid) return;
    setUndoStack((s) => s.slice(0, -1));
    const t = tally.current[last.deckId];
    if (t) { t.answers = Math.max(0, t.answers - 1); t.ms = Math.max(0, t.ms - last.durationMs); }
    await undoAnswer(uid, last.cardId, last.before, last.logId, last.day, negate(last.delta));
    setCurrentId(last.cardId);
    setShowAnswer(false);
  }, [undoStack, uid]);

  const bury = () => current && updateItem<Card>(uid, "cards", current.id, { buriedUntil: daysAgoStr(-1) });
  const suspend = () => current && updateItem<Card>(uid, "cards", current.id, { suspended: true });

  // Keys: Space/Enter show answer (then Good), 1–4 answer, Z undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); undo(); return; }
      if (!current) return;
      if (!showAnswer && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setShowAnswer(true); return; }
      if (showAnswer) {
        const a = ANSWERS.find((x) => x.key === e.key) ?? (e.key === " " || e.key === "Enter" ? ANSWERS[2] : undefined);
        if (a) { e.preventDefault(); answer(a.rating); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, showAnswer, answer, undo]);

  if (loading) return null;
  const backHref = deckParam ? `/flashcards/deck?id=${deckParam}` : "/flashcards";

  if (!current) {
    return (
      <div className="max-w-xl mx-auto glass-card p-8 flex flex-col items-center gap-4 text-center" data-testid="review-done">
        <span className="material-symbols-outlined text-5xl text-secondary">task_alt</span>
        <h1 className="font-grotesk font-bold text-2xl text-on-surface">Done for now</h1>
        <p className="text-sm text-on-surface-variant">
          {queue.laterToday.length > 0
            ? `${queue.laterToday.length} learning card${queue.laterToday.length === 1 ? "" : "s"} will be ready again later today.`
            : "No more cards are due today."}
        </p>
        {savedMsg && <p data-testid="review-saved" className="text-sm text-primary">{savedMsg}</p>}
        <div className="flex gap-2">
          {undoStack.length > 0 && <button onClick={undo} className={secondaryBtnCls}>Undo last</button>}
          <Link href={backHref} className={primaryBtnCls}>Back</Link>
        </div>
      </div>
    );
  }

  const sides = note ? cardSides(note, current.ord) : { front: "Loading…", back: "" };
  const intervals = previewIntervals(current, new Date(), deck);
  const kind = current.state === 0 ? "new" : current.state === 2 ? "review" : "learning";

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4" data-testid="review">
      <div className="flex items-center gap-3 text-sm">
        <Link href={backHref} aria-label="Stop studying" className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">close</span></Link>
        <span className="text-on-surface-variant truncate">{deck?.name}</span>
        <div className="ml-auto flex gap-3 font-jetbrains" data-testid="review-counts">
          <span className={`text-primary ${kind === "new" ? "underline" : ""}`}>{queue.counts.new}</span>
          <span className={`text-error ${kind === "learning" ? "underline" : ""}`}>{queue.counts.learning}</span>
          <span className={`text-secondary ${kind === "review" ? "underline" : ""}`}>{queue.counts.review}</span>
        </div>
      </div>

      <div className="glass-card p-6 sm:p-8 min-h-[260px] flex flex-col gap-4 text-lg text-on-surface text-center justify-center">
        <CardHtml html={sides.front} testId="review-front" />
        {showAnswer && (<><hr className="border-outline-variant/50" /><CardHtml html={sides.back} testId="review-back" /></>)}
      </div>

      {!showAnswer ? (
        <button data-testid="review-show" onClick={() => setShowAnswer(true)} className={`${primaryBtnCls} py-4 text-base`}>Show answer <span className="opacity-60 text-xs">(Space)</span></button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {ANSWERS.map((a) => (
            <button key={a.rating} data-testid={`review-answer-${a.label.toLowerCase()}`} onClick={() => answer(a.rating)}
              className={`rounded-xl border py-3 flex flex-col items-center gap-0.5 font-bold text-sm active:scale-95 transition-all ${BUTTON_STYLE[a.rating]}`}>
              <span className="font-jetbrains text-[11px] font-normal opacity-80" data-testid="review-interval">{intervals[a.rating]}</span>
              {a.label}
              <span className="hidden sm:block text-[10px] font-normal opacity-60">key {a.key}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-4 text-xs text-on-surface-variant">
        <button onClick={undo} disabled={undoStack.length === 0} data-testid="review-undo" className="flex items-center gap-1 disabled:opacity-30"><span className="material-symbols-outlined text-[16px]">undo</span>Undo (Z)</button>
        <button onClick={bury} data-testid="review-bury" className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">visibility_off</span>Hide until tomorrow</button>
        <button onClick={suspend} data-testid="review-suspend" className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">pause_circle</span>Suspend</button>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return <Suspense><Review /></Suspense>;
}
