import { test, expect, type Page } from "@playwright/test";
import { login, evidence } from "./helpers";
import { addSubject } from "./helpers-data";

async function makeDeck(page: Page, name: string, subject: string) {
  await page.goto("/flashcards/");
  await page.getByTestId("deck-new").click();
  await page.getByTestId("deck-name").fill(name);
  await page.getByTestId("deck-subject").selectOption({ label: subject });
  await page.getByTestId("deck-save").click();
  await expect(page.getByTestId("deck-title")).toHaveText(name);
}

async function addBasic(page: Page, front: string, back: string) {
  await page.getByTestId("note-type-basic").click();
  await page.getByTestId("note-front").fill(front);
  await page.getByTestId("note-back").fill(back);
  await page.getByTestId("note-save").click();
  await expect(page.getByTestId("note-message")).toHaveText("Added 1 card.");
}

test("decks, basic + cloze cards, review with FSRS, undo, session saved", async ({ page }) => {
  await login(page, "flash");
  await addSubject(page, "Biology");
  await makeDeck(page, "Cells", "Biology");

  await addBasic(page, "What is the powerhouse of the cell?", "The mitochondria");
  await page.getByTestId("note-type-cloze").click();
  await page.getByTestId("note-front").fill("{{c1::Ribosomes}} make {{c2::proteins::what?}}");
  await page.getByTestId("note-save").click();
  await expect(page.getByTestId("note-message")).toHaveText("Added 2 cards.");
  await expect(page.getByTestId("note-item")).toHaveCount(2);
  await expect(page.getByTestId("deck-total")).toHaveText("Cards (3)"); // updates without a reload
  await evidence(page, "10-deck");

  // Study: one new card per note per day → 2 cards (basic + first cloze)
  await page.getByTestId("deck-study-now").click();
  await expect(page.getByTestId("review")).toBeVisible();
  await expect(page.getByTestId("review-counts")).toContainText("2");
  await expect(page.getByTestId("review-front")).toContainText("What is the powerhouse of the cell?");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("review-back")).toContainText("The mitochondria");
  const intervals = await page.getByTestId("review-interval").allTextContents();
  expect(intervals[0]).toBe("1m");  // Again
  expect(intervals[2]).toBe("10m"); // Good
  await evidence(page, "11-review-answer");

  // Good (key 3) → learning, then undo brings it back
  await page.keyboard.press("3");
  await expect(page.getByTestId("review-front")).toContainText("[...]");
  await page.getByTestId("review-undo").click();
  await expect(page.getByTestId("review-front")).toContainText("What is the powerhouse of the cell?");

  // Easy on both cards → graduated to review, done for today
  await page.getByTestId("review-show").click();
  await page.getByTestId("review-answer-easy").click();
  // Cloze 1: "Ribosomes" is hidden, the other gap shows its answer
  await expect(page.getByTestId("review-front")).toHaveText("[...] make proteins");
  await page.getByTestId("review-show").click();
  await expect(page.getByTestId("review-back")).toHaveText("Ribosomes make proteins");
  await page.getByTestId("review-answer-easy").click();
  await expect(page.getByTestId("review-done")).toBeVisible();
  await expect(page.getByTestId("review-saved")).toContainText("Saved 2 answers as 1 min of study.");
  await evidence(page, "11-review-done");

  // The review time is a study session; stats count the answers
  await page.goto("/sessions/");
  await expect(page.locator("main")).toContainText("Biology");
  await page.goto("/flashcards/stats/");
  await expect(page.getByTestId("stats-today-cards")).toHaveText("2");
  await expect(page.getByTestId("stats-counts")).toContainText("Young (< 21 days)");
  await evidence(page, "12-flashcard-stats");
  await page.goto("/flashcards/");
  await expect(page.getByTestId("deck-counts")).toContainText("Done for today");
});

test("daily new-card limit and suspend", async ({ page }) => {
  await login(page, "limits");
  await addSubject(page, "French");
  await makeDeck(page, "Words", "French");
  for (const [f, b] of [["chat", "cat"], ["chien", "dog"], ["oiseau", "bird"]]) await addBasic(page, f, b);

  await page.getByTestId("deck-settings").click();
  await page.getByTestId("deck-new-limit").fill("2");
  await page.getByTestId("deck-save").click();
  await expect(page.getByTestId("deck-study-now")).toHaveText(/Study \(2\)/);

  // Suspending a card lets the third new card in; the day still stops at 2 new cards.
  await page.getByTestId("deck-study-now").click();
  await expect(page.getByTestId("review-counts")).toHaveText("200");
  await page.getByTestId("review-suspend").click();
  await expect(page.getByTestId("review-counts")).toHaveText("200");
  for (let i = 0; i < 2; i++) {
    await page.getByTestId("review-show").click();
    await page.getByTestId("review-answer-easy").click();
  }
  await expect(page.getByTestId("review-done")).toBeVisible();
  await expect(page.getByTestId("review-saved")).toContainText("Saved 2 answers");
  await page.goto("/flashcards/stats/");
  await expect(page.getByTestId("stats-counts")).toContainText("Suspended");
});
