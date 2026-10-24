// Flashcard review: same queue, scheduling (FSRS), saving and undo as the website's
// /flashcards/review page — only the screen is native.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useStudyCards, useNotesByIds } from "@/lib/firebase/useFlashcards";
import { useCollection } from "@/lib/firebase/useCollection";
import { dayDelta, negate, type DayDelta } from "@/lib/flashcards/reviewDays";
import { updateItem, linkSessionToBlock } from "@/lib/firebase/firestore";
import { saveAnswer, undoAnswer, saveReviewSession } from "@/lib/firebase/flashcards";
import { buildQueue, LEARN_AHEAD_MS } from "@/lib/flashcards/queue";
import { answerCard, previewIntervals, ANSWERS, type Answer, type SchedFields } from "@/lib/flashcards/scheduler";
import { cardSides } from "@/lib/flashcards/cloze";
import { localDateStr, daysAgoStr } from "@/lib/dateUtils";
import type { Card, Subject } from "@/types";
import CardFace from "~/components/card-face";
import { Button, Icon, Loading } from "~/components/ui";
import { colors, radius, space, tint } from "~/theme";

const ANSWER_COLOR: Record<number, string> = { 1: colors.error, 2: colors.amber, 3: colors.green, 4: colors.primary };

interface UndoItem { cardId: string; deckId: string; before: SchedFields & Pick<Card, "suspended">; logId: string; durationMs: number; day: string; delta: DayDelta }
interface Tally { answers: number; ms: number }

function pickSched(c: Card): SchedFields & Pick<Card, "suspended"> {
  const { due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, suspended } = c;
  return { due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, suspended };
}

export default function Review() {
  const { deck: deckParam, block: blockParam } = useLocalSearchParams<{ deck?: string; block?: string }>();
  const insets = useSafeAreaInsets();
  const { uid, decks, cards, logsToday, loading } = useStudyCards();
  const subjects = useCollection<Subject>("subjects").items;

  const [now, setNow] = useState(() => Date.now());
  const [currentId, setCurrentId] = useState<string | null>(null);
  /** The card whose answer is shown (null = question side). */
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<{ id: string; reps: number } | null>(null);
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [savedMsg, setSavedMsg] = useState("");
  const shownAt = useRef(0);
  const startedAt = useRef<Date | null>(null);
  const tally = useRef<Record<string, Tally>>({});

  // Re-check every 15 s so learning cards appear when they are due.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);

  const activeDecks = useMemo(() => (deckParam ? decks.filter((d) => d.id === deckParam) : decks), [decks, deckParam]);
  const today = localDateStr(new Date(now));
  // A card just answered stays hidden until its new state arrives (prevents a double answer).
  const pending = waiting && cards.some((c) => c.id === waiting.id && c.reps === waiting.reps) ? waiting : null;
  const visibleCards = pending ? cards.filter((c) => !(c.id === pending.id && c.reps === pending.reps)) : cards;
  let queue = buildQueue(visibleCards, activeDecks, logsToday, new Date(now), today);
  if (queue.cards.length === 0) queue = buildQueue(visibleCards, activeDecks, logsToday, new Date(now), today, LEARN_AHEAD_MS);
  const current = queue.cards.find((c) => c.id === currentId) ?? queue.cards[0];
  const deck = decks.find((d) => d.id === current?.deckId);
  const notesById = useNotesByIds(queue.cards.slice(0, 20).map((c) => c.noteId));
  const note = current ? notesById[current.noteId] : undefined;
  const showAnswer = !!current && revealedId === current.id;
  // Keep the shown card in place while the queue changes (e.g. a learning card becomes due).
  if (current && current.id !== currentId) setCurrentId(current.id);

  // Time on a card is measured from when it is shown.
  useEffect(() => { shownAt.current = Date.now(); }, [current?.id]);

  /** Saves the review time as study sessions (one per deck), so it counts in streaks and reports. */
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

  // Leaving the screen also saves the review time.
  const saveRef = useRef(saveSessions);
  useEffect(() => { saveRef.current = saveSessions; }, [saveSessions]);
  useEffect(() => () => { saveRef.current(); }, []);

  const finished = !loading && !current;
  useEffect(() => {
    if (finished && Object.keys(tally.current).length > 0) saveSessions().then((m) => m && setSavedMsg(m));
  }, [finished, saveSessions]);

  const answer = useCallback(async (rating: Answer) => {
    if (!current || !uid) return;
    Haptics.impactAsync(rating === 1 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const durationMs = Date.now() - shownAt.current;
    const result = answerCard(current, rating, new Date(), deck, durationMs);
    setWaiting({ id: current.id, reps: current.reps });
    setRevealedId(null);
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
    setRevealedId(null);
  }, [undoStack, uid]);

  const bury = () => current && updateItem<Card>(uid, "cards", current.id, { buriedUntil: daysAgoStr(-1) });
  const suspend = () => current && updateItem<Card>(uid, "cards", current.id, { suspended: true });

  if (loading) return <Loading />;
  const close = (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Stop studying" testID="review-close">
      <Icon name={{ ios: "xmark", android: "close" }} size={20} color={colors.textMuted} />
    </Pressable>
  );

  if (!current) {
    return (
      <View style={[s.page, s.done, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]} testID="review-done">
        <View style={s.topBar}>{close}</View>
        <View style={s.doneBody}>
          <Icon name={{ ios: "checkmark.circle.fill", android: "task_alt" }} size={56} color={colors.green} />
          <Text style={s.doneTitle}>Done for now</Text>
          <Text style={s.muted}>
            {queue.laterToday.length > 0
              ? `${queue.laterToday.length} learning card${queue.laterToday.length === 1 ? "" : "s"} will be ready again later today.`
              : "No more cards are due today."}
          </Text>
          {savedMsg ? <Text style={{ color: colors.primary, textAlign: "center" }} testID="review-saved">{savedMsg}</Text> : null}
        </View>
        <View style={{ gap: space.sm }}>
          {undoStack.length > 0 && <Button label="Undo last" kind="secondary" onPress={undo} />}
          <Button label="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const sides = note ? cardSides(note, current.ord) : null;
  const intervals = previewIntervals(current, new Date(), deck);
  const kind = current.state === 0 ? "new" : current.state === 2 ? "review" : "learning";

  return (
    <View style={[s.page, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.sm }]} testID="review">
      <View style={s.topBar}>
        {close}
        <Text style={s.deckName} numberOfLines={1}>{deck?.name}</Text>
        <View style={s.counts} accessible accessibilityLabel={`${queue.counts.new} new, ${queue.counts.learning} learning, ${queue.counts.review} review`}>
          <Text style={[s.count, { color: colors.primary }, kind === "new" && s.countOn]}>{queue.counts.new}</Text>
          <Text style={[s.count, { color: colors.error }, kind === "learning" && s.countOn]}>{queue.counts.learning}</Text>
          <Text style={[s.count, { color: colors.green }, kind === "review" && s.countOn]}>{queue.counts.review}</Text>
        </View>
      </View>

      <View style={s.card} accessibilityLabel={showAnswer ? "Card" : "Card. Tap to show the answer"}>
        {sides ? <CardFace front={sides.front} back={showAnswer ? sides.back : undefined} onTap={async () => setRevealedId(current.id)}
          dom={{ style: { flex: 1, backgroundColor: "transparent" }, containerStyle: { flex: 1 } }} />
          : <View style={s.cardLoading}><Text style={s.muted}>Loading…</Text></View>}
      </View>

      {!showAnswer ? (
        <Button testID="review-show" label="Show answer" onPress={() => setRevealedId(current.id)} style={{ minHeight: 56 }} />
      ) : (
        <View style={s.answers}>
          {ANSWERS.map((a) => (
            <Pressable key={a.rating} testID={`review-answer-${a.label.toLowerCase()}`} onPress={() => answer(a.rating)}
              accessibilityRole="button" accessibilityLabel={`${a.label}, next in ${intervals[a.rating]}`}
              style={({ pressed }) => [s.answer, { backgroundColor: tint(ANSWER_COLOR[a.rating], 0.14), borderColor: tint(ANSWER_COLOR[a.rating], 0.4) }, pressed && { opacity: 0.7 }]}>
              <Text style={[s.interval, { color: ANSWER_COLOR[a.rating] }]}>{intervals[a.rating]}</Text>
              <Text style={[s.answerLabel, { color: ANSWER_COLOR[a.rating] }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={s.tools}>
        <Tool label="Undo" icon={{ ios: "arrow.uturn.backward", android: "undo" }} onPress={undo} disabled={undoStack.length === 0} />
        <Tool label="Hide until tomorrow" icon={{ ios: "eye.slash", android: "visibility_off" }} onPress={bury} />
        <Tool label="Suspend" icon={{ ios: "pause.circle", android: "pause_circle" }} onPress={suspend} />
      </View>
    </View>
  );
}

function Tool({ label, icon, onPress, disabled }: { label: string; icon: import("~/components/ui").IconName; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={[s.tool, disabled && { opacity: 0.3 }]}>
      <Icon name={icon} size={15} />
      <Text style={s.toolText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg, gap: space.md },
  topBar: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  deckName: { flex: 1, color: colors.textMuted, fontSize: 15 },
  counts: { flexDirection: "row", gap: space.md },
  count: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  countOn: { textDecorationLine: "underline" },
  card: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  cardLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  answers: { flexDirection: "row", gap: space.sm },
  answer: { flex: 1, borderWidth: 1, borderRadius: radius.md, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 2 },
  interval: { fontSize: 12, fontVariant: ["tabular-nums"], opacity: 0.85 },
  answerLabel: { fontSize: 16, fontWeight: "700" },
  tools: { flexDirection: "row", justifyContent: "center", gap: space.lg, flexWrap: "wrap" },
  tool: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  toolText: { color: colors.textMuted, fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 15, textAlign: "center" },
  done: { justifyContent: "space-between" },
  doneBody: { alignItems: "center", gap: space.md, paddingHorizontal: space.lg },
  doneTitle: { color: colors.text, fontSize: 24, fontWeight: "700" },
});
