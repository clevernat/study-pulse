import { clozeNumbers, renderCloze, cardOrds, cardSides, textToHtml, htmlToText, notePreview } from "./cloze";
import { newCardFields, answerCard, previewIntervals, formatInterval, Rating, LEECH_LAPSES, retrievability } from "./scheduler";
import { buildQueue, dayBounds, LEARN_AHEAD_MS } from "./queue";
import { forecast } from "./stats";
import type { Card, Deck } from "@/types";

const NOW = new Date(2026, 9, 23, 10, 0, 0); // Oct 23, 10:00 local
const deck = (over: Partial<Deck> = {}): Deck => ({ id: "d1", name: "D", subjectId: "s", newPerDay: 20, reviewsPerDay: 200, retention: 0.9, createdAt: 0, ...over });
const card = (over: Partial<Card> = {}): Card => ({
  id: "c" + Math.random(), noteId: "n" + Math.random(), deckId: "d1", ord: 0, ...newCardFields(NOW),
  suspended: false, buriedUntil: null, createdAt: 0, ...over,
});

describe("cloze", () => {
  const text = "{{c2::Canberra}} was founded in {{c1::1913::year}}. {{c1::Again}}";
  it("finds one card per number", () => {
    expect(clozeNumbers(text)).toEqual([1, 2]);
    expect(cardOrds("cloze", { text })).toEqual([1, 2]);
    expect(cardOrds("cloze", { text: "no clozes" })).toEqual([]);
  });
  it("hides the active cloze (with hint) and shows the others", () => {
    expect(renderCloze(text, 1, "front")).toBe('Canberra was founded in <span class="cloze-blank">[year]</span>. <span class="cloze-blank">[...]</span>');
    expect(renderCloze(text, 2, "front")).toBe('<span class="cloze-blank">[...]</span> was founded in 1913. Again');
    expect(renderCloze(text, 1, "back")).toContain('<span class="cloze-answer">1913</span>');
  });
  it("basic, reverse and cloze card sides", () => {
    expect(cardOrds("basic", {})).toEqual([0]);
    expect(cardOrds("basicReverse", {})).toEqual([0, 1]);
    expect(cardSides({ type: "basicReverse", fields: { front: "hola", back: "hello" } }, 1)).toEqual({ front: "hello", back: "hola" });
    expect(cardSides({ type: "cloze", fields: { text: "{{c1::x}}", extra: "more" } }, 1).back).toBe('<span class="cloze-answer">x</span><hr/>more');
  });
  it("escapes typed text and turns it back", () => {
    const html = textToHtml('a < b & "c"\nnext');
    expect(html).toBe("a &lt; b &amp; &quot;c&quot;<br>next");
    expect(htmlToText(html)).toBe('a < b & "c"\nnext');
    expect(notePreview({ type: "cloze", fields: { text: "The {{c1::cell}} is <b>small</b>" } })).toBe("The cell is small");
  });
});

describe("scheduler (ts-fsrs)", () => {
  it("new cards are due now and state New", () => {
    const f = newCardFields(NOW);
    expect(f.state).toBe(0);
    expect(f.due).toBe(NOW.getTime());
    expect(f.last_review).toBeNull();
  });
  it("Good on a new card starts learning (10 minutes), Easy graduates for days", () => {
    const c = card();
    const good = answerCard(c, Rating.Good, NOW);
    expect(good.fields.state).toBe(1);
    expect(good.fields.due - NOW.getTime()).toBe(10 * 60_000);
    expect(good.log.state).toBe(0);
    expect(good.log.rating).toBe(3);
    const easy = answerCard(c, Rating.Easy, NOW);
    expect(easy.fields.state).toBe(2);
    expect(easy.fields.scheduled_days).toBeGreaterThanOrEqual(1);
  });
  it("Again on a review card counts a lapse and relearns; leeches get suspended", () => {
    const review = card({ ...answerCard(card(), Rating.Easy, NOW).fields });
    const later = new Date(review.due + 1000);
    const again = answerCard(review, Rating.Again, later);
    expect(again.fields.state).toBe(3);
    expect(again.fields.lapses).toBe(1);
    expect(again.fields.suspended).toBeUndefined();
    const leech = answerCard({ ...review, lapses: LEECH_LAPSES - 1 }, Rating.Again, later);
    expect(leech.fields.suspended).toBe(true);
  });
  it("intervals grow Again < Hard < Good < Easy and are shown as text", () => {
    const p = previewIntervals(card(), NOW);
    expect(p[Rating.Again]).toBe("1m");
    expect(p[Rating.Good]).toBe("10m");
    expect(formatInterval(90 * 60_000)).toBe("2h");
    expect(formatInterval(3 * 86_400_000)).toBe("3d");
    expect(formatInterval(45 * 86_400_000)).toBe("1.5mo");
    expect(formatInterval(730 * 86_400_000)).toBe("2y");
  });
  it("saves dates as numbers (Firestore-safe, no undefined)", () => {
    const r = answerCard(card(), Rating.Good, NOW);
    expect(typeof r.fields.due).toBe("number");
    expect(typeof r.fields.last_review).toBe("number");
    expect(Object.values(r.log).some((v) => v === undefined)).toBe(false);
  });
  it("retrievability: 0 for new cards, between 0 and 1 for reviewed cards", () => {
    expect(retrievability(card(), NOW)).toBe(0);
    const review = card({ ...answerCard(card(), Rating.Easy, NOW).fields });
    const r = retrievability(review, new Date(NOW.getTime() + 86_400_000));
    expect(r).toBeGreaterThan(0.5);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe("buildQueue", () => {
  const today = "2026-10-23";
  const { end } = dayBounds(NOW);
  it("orders learning, then reviews (oldest first), then new (oldest first)", () => {
    const learn = card({ id: "learn", state: 1, due: NOW.getTime() - 1000 });
    const rev1 = card({ id: "rev-old", state: 2, due: NOW.getTime() - 86_400_000 * 3 });
    const rev2 = card({ id: "rev-today", state: 2, due: end - 1000 });
    const revTomorrow = card({ id: "rev-tomorrow", state: 2, due: end + 1000 });
    const new1 = card({ id: "new-1", createdAt: 1 });
    const new2 = card({ id: "new-2", createdAt: 2 });
    const q = buildQueue([new2, revTomorrow, rev2, new1, learn, rev1], [deck()], [], NOW, today);
    expect(q.cards.map((c) => c.id)).toEqual(["learn", "rev-old", "rev-today", "new-1", "new-2"]);
    expect(q.counts).toEqual({ learning: 1, review: 2, new: 2 });
  });
  it("respects daily limits, counting today's answers", () => {
    const news = Array.from({ length: 5 }, (_, i) => card({ id: `n${i}`, createdAt: i }));
    const revs = Array.from({ length: 5 }, (_, i) => card({ id: `r${i}`, state: 2, due: NOW.getTime() - i }));
    const logs = [{ cardId: "x", noteId: "nx", deckId: "d1", state: 0 }, { cardId: "y", noteId: "ny", deckId: "d1", state: 2 }];
    const q = buildQueue([...news, ...revs], [deck({ newPerDay: 3, reviewsPerDay: 4 })], logs, NOW, today);
    expect(q.counts).toEqual({ learning: 0, review: 3, new: 2 });
  });
  it("leaves out suspended, buried and other decks' cards; one new card per note", () => {
    const sus = card({ suspended: true });
    const buried = card({ buriedUntil: "2026-10-24" });
    const otherDeck = card({ deckId: "d2" });
    const a = card({ id: "a", noteId: "same", ord: 1 });
    const b = card({ id: "b", noteId: "same", ord: 2 });
    const q = buildQueue([sus, buried, otherDeck, a, b], [deck()], [], NOW, today);
    expect(q.cards.map((c) => c.id)).toEqual(["a"]);
  });
  it("buries new siblings of a note studied today; buried-until-today cards are back", () => {
    const sib = card({ id: "sib", noteId: "note1" });
    const back = card({ id: "back", buriedUntil: today });
    const q = buildQueue([sib, back], [deck()], [{ cardId: "x", noteId: "note1", deckId: "d1", state: 0 }], NOW, today);
    expect(q.cards.map((c) => c.id)).toEqual(["back"]);
  });
  it("learning cards not due yet wait; with learn-ahead, those due within 20 minutes are shown", () => {
    const soon = card({ id: "soon", state: 1, due: NOW.getTime() + 5 * 60_000 });
    const later = card({ id: "later", state: 1, due: NOW.getTime() + 60 * 60_000 });
    expect(buildQueue([soon, later], [deck()], [], NOW, today).cards).toEqual([]);
    const q = buildQueue([soon, later], [deck()], [], NOW, today, LEARN_AHEAD_MS);
    expect(q.cards.map((c) => c.id)).toEqual(["soon"]);
    expect(q.laterToday.map((c) => c.id)).toEqual(["later"]);
  });
});

describe("stats", () => {
  it("forecast puts overdue cards on day 0 and skips new/suspended", () => {
    const starts = [0, 1, 2].map((i) => Date.UTC(2026, 9, 23 + i));
    const cards = [
      card({ state: 2, due: starts[0] - 5 }), card({ state: 2, due: starts[0] + 5 }),
      card({ state: 2, due: starts[2] + 5 }), card({ state: 0, due: starts[1] }), card({ state: 2, due: starts[1], suspended: true }),
      card({ state: 2, due: starts[2] + 2 * 86_400_000 }),
    ];
    expect(forecast(cards, starts)).toEqual([2, 0, 1]);
  });
});
