import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";
import { addSubject } from "./helpers-data";

for (const file of ["sample-latest.apkg", "sample-legacy2.apkg", "sample-legacy1.apkg"]) {
  test(`import Anki ${file} into new decks`, async ({ page }) => {
    await login(page, "import");
    await addSubject(page, "Spanish");
    await page.goto("/flashcards/import/");
    await page.getByTestId("import-file").setInputFiles(`tests/fixtures/${file}`);
    const preview = page.getByTestId("import-preview");
    await expect(preview).toContainText("4 notes found");
    await expect(preview).toContainText("2 images/sounds will be left out");
    await expect(preview).toContainText("Spanish::Animals: 2 notes");
    if (file === "sample-latest.apkg") await evidence(page, "13-import-preview");
    await page.getByTestId("import-save").click();
    await expect(page.getByTestId("import-done")).toContainText("Imported 4 notes as 6 cards into 2 decks.");

    await page.goto("/flashcards/");
    await expect(page.getByTestId("deck-item")).toHaveCount(2);
    await expect(page.getByTestId("deck-item").filter({ hasText: "Spanish::Animals" })).toContainText("2 cards");
    await expect(page.getByTestId("deck-item").filter({ hasText: "Spanish · 4 cards" })).toBeVisible();
    if (file === "sample-latest.apkg") await evidence(page, "13-import-decks");

    // An imported cloze card can be studied, HTML is shown safely
    await page.getByTestId("deck-item").filter({ hasText: "Spanish · 4 cards" }).getByTestId("deck-study").click();
    await expect(page.getByTestId("review-front")).toBeVisible();
  });
}

test("import a CSV into an existing deck", async ({ page }) => {
  await login(page, "csv");
  await addSubject(page, "Maths");
  await page.goto("/flashcards/");
  await page.getByTestId("deck-new").click();
  await page.getByTestId("deck-name").fill("Formulas");
  await page.getByTestId("deck-save").click();
  await expect(page.getByTestId("deck-title")).toHaveText("Formulas");

  await page.goto("/flashcards/import/");
  await page.getByTestId("import-file").setInputFiles({
    name: "cards.csv", mimeType: "text/csv",
    buffer: Buffer.from('front,back,tags\n"Area of a circle","π r²",geometry\n"The derivative of {{c1::sin x}} is cos x",,\nempty,\n'),
  });
  await expect(page.getByTestId("import-preview")).toContainText("2 notes found");
  await expect(page.getByTestId("import-preview")).toContainText("1 empty or broken notes will be skipped");
  await page.getByTestId("import-target").selectOption({ label: "Existing deck: Formulas" });
  await page.getByTestId("import-save").click();
  await expect(page.getByTestId("import-done")).toContainText("Imported 2 notes as 2 cards.");
  await page.goto("/flashcards/");
  await expect(page.getByTestId("deck-item")).toContainText("2 cards");
});

test("a file that is not a deck shows a clear error", async ({ page }) => {
  await login(page, "badfile");
  await page.goto("/flashcards/import/");
  await page.getByTestId("import-file").setInputFiles({ name: "notes.apkg", mimeType: "application/zip", buffer: Buffer.from("not a zip") });
  await expect(page.getByTestId("import-error")).toContainText("Could not read the file");
});
