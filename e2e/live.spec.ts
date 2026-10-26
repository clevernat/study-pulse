// While the timer runs: minutes count live everywhere, Start becomes Pause/Resume,
// the topic shows, and the calendar shows the session and the goal's whole period.
import { test, expect } from "@playwright/test";
import { evidence, login } from "./helpers";
import { addSubject, dayFromToday, setGoalOnTimer } from "./helpers-data";

test("running timer: live minutes on Today, Pause/Resume button, topic everywhere, calendar", async ({ page, isMobile }) => {
  await page.clock.install();
  await login(page, "live");
  await addSubject(page, "Networking");
  await page.goto("/timer/");
  await page.getByText("Select a Subject").first().click();
  await page.getByText("Networking").last().click();
  // Type the topic right on the timer
  await page.getByTestId("timer-topic-new-input").fill("Subnetting");
  await page.getByTestId("timer-topic-new-input").press("Enter");
  await expect(page.getByTestId("timer-topic").locator("option:checked")).toHaveText("Subnetting");
  await setGoalOnTimer(page, "Learn encapsulation");
  await page.getByTestId("timer-start").click();
  await page.clock.fastForward("03:10");

  await page.getByTestId(isMobile ? "bottom-nav-today" : "nav-today").click();
  const goal = page.getByTestId("goals-first-item").filter({ hasText: "Learn encapsulation" });
  await expect(goal).toContainText("3 min of 2 hrs");
  await expect(goal.getByTestId("goals-first-now")).toContainText("Studying now: Subnetting · 3 min so far");
  await expect(page.getByTestId("today-live-session")).toBeVisible();
  const btn = goal.getByTestId("goals-first-start");
  await expect(btn).toHaveAttribute("data-timer", "running");
  await expect(btn).toContainText("Pause");
  await expect(page.getByTestId("floating-timer")).toContainText("Networking · Subnetting");
  await evidence(page, "54-live-today");

  // Pause from Today, then Resume
  await btn.click();
  await expect(btn).toHaveAttribute("data-timer", "paused");
  await expect(btn).toContainText("Resume");
  await page.clock.fastForward("05:00"); // paused time does not count
  await expect(goal).toContainText("3 min of 2 hrs");
  await btn.click();
  await expect(btn).toHaveAttribute("data-timer", "running");

  // Calendar: the running session, and the goal on every day of its week
  await page.goto("/calendar/");
  await page.getByTestId("cal-view-week").click();
  await expect(page.locator("main")).toContainText("Networking · Subnetting");
  await expect(page.locator("main")).toContainText("Start: Learn encapsulation");
  await page.getByTestId("cal-next").click();
  await expect(page.locator("main")).toContainText("Learn encapsulation");
  await evidence(page, "55-calendar-goal-week");
});

test("a goal from today for 3 months fills the calendar month by month", async ({ page }) => {
  await login(page, "longgoal");
  await addSubject(page, "Security");
  await page.goto("/goals/");
  await page.getByRole("button", { name: /New Goal/ }).first().click();
  await page.getByPlaceholder("e.g. Weekly Study Goal").fill("Security+ course");
  await page.locator("select").filter({ hasText: "Select a subject" }).selectOption({ label: "Security" });
  await page.getByTestId("goal-length-3-months").click();
  await expect(page.getByTestId("goal-deadline")).toHaveValue(await dayFromToday(page, 91));
  await page.getByRole("button", { name: /Create Goal/ }).click();
  await expect(page.getByPlaceholder("e.g. Weekly Study Goal")).toBeHidden();
  await expect(page.locator("main")).toContainText("Security+ course");

  await page.goto("/calendar/");
  await page.getByTestId("cal-view-month").click();
  await expect(page.locator("main")).toContainText("Security+ course");
  for (let i = 0; i < 3; i++) await page.getByTestId("cal-next").click(); // three months on: the due date
  await expect(page.locator("main")).toContainText("Due: Security+ course");
  await evidence(page, "56-calendar-goal-month");
});

test("an empty calendar says what will appear there", async ({ page }) => {
  await login(page, "calempty");
  await page.goto("/calendar/");
  await expect(page.getByTestId("cal-empty")).toContainText("every day from start to deadline");
});
