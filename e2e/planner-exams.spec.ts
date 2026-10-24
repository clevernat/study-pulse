import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";
import { addSubject, dayFromToday } from "./helpers-data";

test("topics: add, check off, see progress on subject and card", async ({ page }) => {
  await login(page, "topics");
  await addSubject(page, "Biology");
  await page.getByTestId("subject-open").filter({ hasText: "Biology" }).click();
  await expect(page.getByTestId("subject-name")).toHaveText("Biology");

  for (const t of ["Cells", "Genetics", "Evolution"]) {
    await page.getByTestId("topic-input").fill(t);
    await page.getByTestId("topic-add").click();
  }
  await expect(page.getByTestId("topic-item")).toHaveCount(3);
  await page.getByTestId("topic-check").first().click();
  await expect(page.getByTestId("topic-progress")).toHaveText("1/3 · 33%");
  await evidence(page, "03-topics");

  await page.goto("/subjects/");
  await expect(page.getByTestId("subject-open").filter({ hasText: "Biology" })).toContainText("Topics 1/3 · 33%");
});

test("exams: add an exam, countdown on dashboard, revision progress", async ({ page }) => {
  await login(page, "exams");
  await addSubject(page, "Chemistry");
  const date = await dayFromToday(page, 5);

  await page.goto("/exams/");
  await page.getByTestId("exam-new").click();
  await page.getByTestId("exam-title").fill("Chemistry final");
  await page.getByTestId("exam-date").fill(date);
  await page.getByTestId("exam-time").fill("09:00");
  await page.getByTestId("exam-room").fill("B12");
  await page.getByTestId("exam-save").click();
  await expect(page.getByTestId("exam-card")).toContainText("Chemistry final");
  await expect(page.getByTestId("exam-card")).toContainText("5 days left");
  await expect(page.getByTestId("exam-card")).toContainText("Room B12");
  await evidence(page, "04-exams");

  // Link a topic and a revision task to the exam → revision progress
  await page.goto("/subjects/");
  await page.getByTestId("subject-open").filter({ hasText: "Chemistry" }).click();
  await page.getByTestId("topic-input").fill("Acids and bases");
  await page.getByTestId("topic-add").click();
  await page.getByLabel("Exam for this topic").selectOption({ label: "Chemistry final" });
  await expect(page.getByLabel("Exam for this topic")).toHaveValue(/.+/);
  await page.getByTestId("topic-check").click();
  await expect(page.getByTestId("topic-progress")).toHaveText("1/1 · 100%");

  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.getByTestId("task-kind-revision").click();
  await page.getByTestId("task-title").fill("Practice paper 1");
  await page.getByTestId("task-exam").selectOption({ label: "Chemistry final" });
  await page.getByTestId("task-save").click();
  await expect(page.getByTestId("task-item")).toContainText("Revision");

  await page.goto("/dashboard/");
  const card = page.getByTestId("exam-countdown");
  await expect(card.getByTestId("exam-countdown-item")).toContainText("Chemistry final");
  await expect(card.getByTestId("exam-countdown-days")).toHaveText("5 days left");
  await expect(card).toContainText("Revision 1/2");
  await evidence(page, "04-dashboard-exams");

  await page.goto("/today/");
  await expect(page.getByTestId("today-exams")).toContainText("Chemistry final");
});

test("homework with due date and time, repeating revision", async ({ page }) => {
  await login(page, "homework");
  const tomorrow = await dayFromToday(page, 1);
  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.getByTestId("task-kind-homework").click();
  await page.getByTestId("task-title").fill("Maths worksheet 4");
  await page.getByTestId("task-due").fill(tomorrow);
  await page.getByTestId("task-time").fill("08:30");
  await page.getByTestId("task-save").click();
  const item = page.getByTestId("task-item").filter({ hasText: "Maths worksheet 4" });
  await expect(item).toContainText("Homework");
  await expect(item).toContainText("1d left · 08:30");

  await page.getByTestId("task-kind-filter").selectOption("homework");
  await expect(page.getByTestId("task-item")).toHaveCount(1);
  await evidence(page, "05-homework");
});
