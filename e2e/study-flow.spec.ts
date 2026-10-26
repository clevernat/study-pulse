// The study flow: subject → topics → goal → timer. Goals come first on Today, and the timer needs a goal.
import { test, expect } from "@playwright/test";
import { evidence, login, seedDoc } from "./helpers";

test("first open: guide on Today → subject → several topics → goal → study a topic", async ({ page, isMobile }) => {
  await login(page, "flow");
  // Today opens with the guide, before anything else
  const guide = page.getByTestId("start-guide");
  await expect(page.locator("main > div > :first-child")).toHaveAttribute("data-testid", "start-guide");
  await expect(guide.getByTestId("guide-step-1")).toHaveAttribute("data-state", "now");
  await evidence(page, "50-start-guide");

  // 1. Subject
  await guide.getByTestId("guide-new-subject").click();
  await page.getByTestId("new-subject-name").fill("Networking");
  await page.getByTestId("new-subject-save").click();
  await expect(guide.getByTestId("guide-step-1")).toHaveAttribute("data-state", "done");

  // 2. Topics (several under one subject)
  await guide.getByTestId("guide-add-topic").click();
  await expect(page.getByTestId("subject-name")).toHaveText("Networking");
  for (const t of ["Subnetting", "OSI model", "IP addressing"]) {
    await page.getByTestId("topic-input").fill(t);
    await page.getByTestId("topic-add").click();
  }
  await expect(page.getByTestId("topic-item")).toHaveCount(3);

  // The timer cannot start yet: no goal
  await page.getByTestId("topic-item").filter({ hasText: "Subnetting" }).getByTestId("topic-study").click();
  await expect(page.getByTestId("timer-start")).toBeDisabled();
  await expect(page.getByTestId("timer-start-hint")).toHaveText("Set a goal to start");
  await expect(page.getByTestId("timer-topic").locator("option:checked")).toHaveText("Subnetting");
  await evidence(page, "51-timer-needs-goal");

  // 3. Goal, set right there on the timer
  await page.getByTestId("timer-set-goal").click();
  await page.getByPlaceholder(/^e\.g\. Master /).fill("Finish subnetting");
  await page.getByRole("button", { name: /Set Goal & Study/ }).click();
  await expect(page.getByTestId("timer-start")).toBeEnabled();

  // Today now opens with the goal, and Start studying goes to the timer
  await page.getByTestId(isMobile ? "bottom-nav-today" : "nav-today").click();
  await expect(page.locator("main > div > :first-child")).toHaveAttribute("data-testid", "goals-first");
  await expect(page.getByTestId("goals-first-item")).toContainText("Finish subnetting");
  await evidence(page, "52-goals-first");
  await page.getByTestId("goals-first-start").click();
  await expect(page).toHaveURL(/\/timer\/?\?subjectId=/);
  await expect(page.getByTestId("timer-start")).toBeEnabled();
});

test("the Study tab opens Subjects first, then Timer, then Flashcards", async ({ page, isMobile }) => {
  await login(page, "studytab");
  await page.getByTestId(isMobile ? "bottom-nav-subjects" : "nav-study").click();
  await expect(page).toHaveURL(/\/subjects\/?$/);
  const tabs = page.getByRole("navigation", { name: "Study pages" }).getByRole("link");
  await expect(tabs).toHaveText(["Subjects", "Timer", "Flashcards"]);
});

test("a subject's page shows its goal and Start studying", async ({ page }) => {
  await login(page, "subjgoal");
  await page.goto("/subjects/");
  await page.getByRole("button", { name: "Add Subject" }).first().click();
  await page.getByPlaceholder("e.g. Calculus II").fill("Security");
  await page.getByPlaceholder("e.g. Calculus II").press("Enter");
  await page.getByTestId("subject-open").filter({ hasText: "Security" }).click();
  await page.getByTestId("subject-goal-set").click();
  await page.getByPlaceholder(/^e\.g\. Master /).fill("Pass Security+");
  await page.getByRole("button", { name: /Set Goal & Study/ }).click();
  await expect(page.getByTestId("subject-goal")).toContainText("Pass Security+");
  await expect(page.getByTestId("subject-goal-start")).toBeVisible();
});

test("Progress shows a GitHub-style year of study squares", async ({ page }) => {
  const { uid } = await login(page, "graph");
  const day = async (n: number) => page.evaluate((k) => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, n);
  for (const [n, min] of [[0, 150], [-1, 40], [-30, 20]] as const) {
    await seedDoc(uid, "sessions", { uid, subjectId: "x", subjectName: "Networking", subjectColor: "violet", durationMinutes: min, focusScore: 100, pomodoroCount: 1, date: await day(n), startTime: "09:00", endTime: "10:00" });
  }
  await page.goto("/dashboard/");
  const graph = page.getByTestId("contribution-graph");
  await expect(graph.getByTestId("contribution-graph-total")).toHaveText("3.5 hrs in the last year, on 3 days");
  await expect(graph.locator(`[data-date="${await day(0)}"]`)).toHaveAttribute("data-level", "4");
  await expect(graph.locator(`[data-date="${await day(-1)}"]`)).toHaveAttribute("data-level", "2");
  await expect(graph.locator(`[data-date="${await day(-2)}"]`)).toHaveAttribute("data-level", "0");
  expect(await graph.getByTestId("contribution-day").count()).toBeGreaterThan(364);
  await evidence(page, "53-year-graph");
});
