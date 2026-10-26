import { test, expect, type Page } from "@playwright/test";
import { login, evidence, seedDoc } from "./helpers";
import { addSubject, dayFromToday } from "./helpers-data";

/** Opens a subject's page and returns its id. */
async function openSubject(page: Page, name: string): Promise<string> {
  await page.goto("/subjects/");
  await page.getByTestId("subject-open").filter({ hasText: name }).click();
  await expect(page.getByTestId("subject-name")).toHaveText(name);
  return new URL(page.url()).searchParams.get("id")!;
}

async function addTopic(page: Page, title: string) {
  await page.getByTestId("topic-input").fill(title);
  await page.getByTestId("topic-add").click();
  await expect(page.getByTestId("topic-item").filter({ hasText: title })).toBeVisible();
}

test("timer: topic, distraction counter and 1–5 focus rating reach sessions, the subject page and the weekly review", async ({ page }) => {
  await page.clock.install();
  await login(page, "focus");
  await addSubject(page, "Calculus");
  await openSubject(page, "Calculus");
  await addTopic(page, "Limits");
  await addTopic(page, "Integrals");

  await page.goto("/timer/");
  await page.getByText("Select a Subject").first().click();
  await page.getByText("Calculus").last().click();
  await page.getByTestId("timer-topic").selectOption({ label: "Limits" });
  await page.getByTestId("timer-start").click();
  await page.getByTestId("timer-distracted").click();
  await page.getByTestId("timer-distracted").click();
  await expect(page.getByTestId("timer-distractions")).toHaveText("2");
  await evidence(page, "30-timer-topic-distractions");

  await page.clock.fastForward("25:30");
  await expect(page.getByText("How focused were you?")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("focus-rating-4").click();
  await evidence(page, "31-focus-rating");
  await page.getByRole("button", { name: "Save Reflection" }).click();
  await expect(page.getByText("How focused were you?")).toBeHidden();

  await page.goto("/sessions/");
  await expect(page.getByTestId("session-topic")).toHaveText("Limits");
  await expect(page.getByTestId("session-distractions")).toContainText("2 distractions");
  await expect(page.getByTestId("focus-badge").first()).toContainText("Focus 4/5");

  await openSubject(page, "Calculus");
  await expect(page.getByTestId("topic-item").filter({ hasText: "Limits" }).getByTestId("topic-minutes")).toHaveText("25 min");
  await expect(page.getByTestId("topic-item").filter({ hasText: "Integrals" }).getByTestId("topic-minutes")).toHaveText("–");

  await page.goto("/review/");
  await expect(page.getByTestId("review-this-week")).toHaveText("25 min");
  await expect(page.getByTestId("review-streak")).toContainText("1 day in a row");
  await expect(page.getByTestId("review-focus")).toContainText("4/5");
  await expect(page.getByTestId("review-best-time")).not.toContainText("Study a few sessions");
  await expect(page.getByTestId("review-topics")).toContainText("Limits (25 min)");
  await expect(page.getByTestId("review-neglected")).toBeVisible();
  await evidence(page, "32-weekly-review");

  await page.goto("/reports/");
  await expect(page.getByTestId("focus-trend")).not.toContainText("No ratings yet");
});

test("study target for a subject on Today (with the total), the Timer and Settings", async ({ page }) => {
  const user = await login(page, "target");
  await addSubject(page, "Physics");
  const subjectId = await openSubject(page, "Physics");
  const today = await dayFromToday(page, 0);
  await seedDoc(user.uid, "sessions", { uid: user.uid, subjectId, subjectName: "Physics", subjectColor: "violet", durationMinutes: 30, focusScore: 100, pomodoroCount: 1, date: today, startTime: "09:00", endTime: "09:30" });

  await page.goto("/today/");
  const card = page.getByTestId("target-card");
  await card.getByTestId("subject-target-add").click();
  await expect(card.getByTestId("subject-target-subject").locator("option:checked")).toHaveText("Physics");
  // Empty boxes are refused
  await card.getByTestId("target-save").click();
  await expect(card.getByRole("alert")).toContainText("Enter hours per day, per week, or both");
  await card.getByTestId("target-daily").fill("1");
  await card.getByTestId("target-weekly").fill("7");
  await card.getByTestId("target-save").click();
  const physics = card.getByTestId("subject-target").filter({ hasText: "Physics" });
  await expect(physics).toContainText("30 min of 1 hr");
  await expect(physics).toContainText("30 min to go");
  await expect(physics).toContainText("of 7 hrs");
  await expect(card.getByTestId("target-total")).toHaveCount(0); // one subject: no separate total

  // A second subject target: now the total shows (7 + 3 hrs a week)
  await card.getByTestId("subject-target-add").click();
  await card.getByTestId("subject-target-subject").selectOption({ label: "+ New subject…" });
  await page.getByTestId("new-subject-name").fill("Chemistry");
  await page.getByTestId("new-subject-save").click();
  await card.getByTestId("subject-target-new").getByTestId("target-weekly").fill("3");
  await card.getByTestId("subject-target-new").getByTestId("target-save").click();
  await expect(card.getByTestId("target-weekly-progress")).toContainText("30 min of 10 hrs");
  await expect(card.getByTestId("target-daily-progress")).toContainText("30 min of 1 hr");
  await evidence(page, "33-target-today");

  await page.goto("/timer/");
  await expect(page.getByTestId("timer-target")).toHaveText("of 1 hr target");

  await page.goto("/settings/");
  await expect(page.getByTestId("target-settings").getByTestId("subject-target").filter({ hasText: "Physics" })).toHaveCount(1);
});

test("results per subject compared with study time", async ({ page }) => {
  const user = await login(page, "results");
  await addSubject(page, "Biology");
  const subjectId = await openSubject(page, "Biology");
  const day = (n: number) => dayFromToday(page, n);
  for (const [n, minutes] of [[-12, 30], [-6, 120], [-2, 300]] as const) {
    await seedDoc(user.uid, "sessions", { uid: user.uid, subjectId, subjectName: "Biology", subjectColor: "violet", durationMinutes: minutes, focusScore: 100, pomodoroCount: 1, date: await day(n), startTime: "18:00", endTime: "18:30" });
  }

  const panel = page.getByTestId("results-panel");
  await expect(panel).toContainText("No results yet");
  for (const [n, score, title] of [[-10, 50, "Quiz 1"], [-5, 70, "Quiz 2"], [0, 90, "Quiz 3"]] as const) {
    await panel.getByTestId("result-title").fill(title);
    await panel.getByTestId("result-date").fill(await day(n));
    await panel.getByTestId("result-score").fill(String(score));
    await panel.getByTestId("result-add").click();
    await expect(panel.getByTestId("result-item").filter({ hasText: title })).toBeVisible();
  }
  // 14 days before each test: 30 min, 2.5 hrs, 7.5 hrs → scores 50 %, 70 %, 90 %.
  await expect(panel.getByTestId("result-item").filter({ hasText: "Quiz 3" }).getByTestId("result-minutes")).toHaveText("Studied 7.5 hrs");
  await expect(panel.getByTestId("results-verdict")).toContainText("Clear link");
  await evidence(page, "34-results");

  // A score above the maximum is refused.
  await panel.getByTestId("result-score").fill("120");
  await panel.getByTestId("result-add").click();
  await expect(panel.getByRole("alert")).toContainText("between 0 and the maximum");
});
