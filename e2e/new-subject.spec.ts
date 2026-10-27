// "+ New subject" inside forms: make a subject without leaving the form.
import { test, expect, type Page } from "@playwright/test";
import { login, PROJECT } from "./helpers";
import { dayFromToday } from "./helpers-data";

const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
async function subjects(uid: string) {
  const r = await fetch(`${FS}/users/${uid}/subjects`, { headers: { Authorization: "Bearer owner" } });
  return (((await r.json()) as { documents?: { name: string; fields: { name: { stringValue: string } } }[] }).documents ?? [])
    .map((d) => ({ id: d.name.split("/").pop()!, name: d.fields.name.stringValue }));
}

async function addInline(page: Page, name: string) {
  await page.getByTestId("new-subject-name").fill(name);
  await page.getByTestId("new-subject-save").click();
  await expect(page.getByTestId("new-subject")).toBeHidden();
}

test("exam, task and goal forms: + New subject creates it and selects it", async ({ page }) => {
  const { uid } = await login(page, "newsub");

  // Exam form, with no subjects yet
  await page.goto("/exams/");
  await page.getByTestId("exam-new").click();
  await page.getByTestId("exam-subject").selectOption({ label: "+ New subject…" });
  await addInline(page, "Biology");
  await expect(page.getByTestId("exam-subject").locator("option:checked")).toHaveText("Biology");
  await page.getByTestId("exam-title").fill("Biology mock");
  await page.getByTestId("exam-date").fill(await dayFromToday(page, 5));
  await page.getByTestId("exam-save").click();
  await expect.poll(async () => (await subjects(uid)).map((s) => s.name)).toEqual(["Biology"]);

  // Task form: Enter in the name box adds the subject and does not submit the task
  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.locator("select:has(option:text('+ New subject…'))").selectOption({ label: "+ New subject…" });
  await page.getByTestId("new-subject-name").fill("Chemistry");
  await page.getByTestId("new-subject-name").press("Enter");
  await expect(page.getByTestId("new-subject")).toBeHidden();
  await expect(page.locator("select:has(option:text('+ New subject…')) option:checked")).toHaveText("Chemistry");
  await expect(page.getByTestId("task-title")).toBeVisible(); // still in the form

  // Goal form
  await page.goto("/goals/");
  await page.getByRole("button", { name: /New Goal/ }).first().click();
  await page.locator("select:has(option:text('+ New subject…'))").selectOption({ label: "+ New subject…" });
  await addInline(page, "Physics");
  await expect(page.locator("select:has(option:text('+ New subject…')) option:checked")).toHaveText("Physics");
  await expect.poll(async () => (await subjects(uid)).map((s) => s.name).sort()).toEqual(["Biology", "Chemistry", "Physics"]);
});

test("timer and Log session: + New subject", async ({ page }) => {
  await login(page, "newsub2");
  await page.goto("/timer/");
  await page.getByText("Select a Subject").first().click();
  await page.getByTestId("timer-new-subject").click();
  await addInline(page, "History");
  await expect(page.getByText("History").first()).toBeVisible();

  await page.goto("/today/");
  await page.getByRole("button", { name: /Log/ }).first().click();
  await page.getByTestId("log-new-subject").click();
  await addInline(page, "Geography");
  await expect(page.getByRole("button", { name: /Geography/ })).toHaveClass(/border-primary/);
});
