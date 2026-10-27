import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";
import { addSubject, dayFromToday, setGoalOnTimer } from "./helpers-data";

test("calendar views show exams, tasks, classes and planned blocks", async ({ page }) => {
  await login(page, "calendar");
  await addSubject(page, "History");
  const today = await dayFromToday(page, 0);

  // An exam and a timed task today
  await page.goto("/exams/");
  await page.getByTestId("exam-new").click();
  await page.getByTestId("exam-title").fill("History essay exam");
  await page.getByTestId("exam-date").fill(today);
  await page.getByTestId("exam-time").fill("09:00");
  await page.getByTestId("exam-save").click();
  await expect(page.getByTestId("exam-card")).toContainText("History essay exam");
  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.getByTestId("task-kind-homework").click();
  await page.getByTestId("task-title").fill("Source analysis");
  await page.getByTestId("task-due").fill(today);
  await page.getByTestId("task-save").click();
  await expect(page.getByTestId("task-item")).toContainText("Source analysis");

  // Plan a block by clicking the 14:00 slot of today
  await page.goto("/calendar/");
  await page.getByTestId("cal-view-week").click();
  await page.locator(`[data-testid="cal-day-column"][data-date="${today}"] [data-testid="cal-slot"][data-hour="14"]`).click();
  await expect(page.getByTestId("block-start")).toHaveValue("14:00");
  await expect(page.getByTestId("block-end")).toHaveValue("15:00");
  await page.getByTestId("block-title").fill("Read chapter 5");
  await page.getByTestId("block-save").click();

  await expect(page.getByTestId("cal-event-block")).toContainText("Read chapter 5");
  // The 14:00 block lines up with the 14:00 row and its hour label (measured in one frame)
  const offsets = () => page.locator(`[data-testid="cal-day-column"][data-date="${today}"]`).evaluate((col) => {
    const top = (e: Element | null) => e!.getBoundingClientRect().top;
    const slot = top(col.querySelector('[data-testid="cal-slot"][data-hour="14"]'));
    const block = top(col.querySelector('[data-testid="cal-event-block"]'));
    const label = Array.from(document.querySelectorAll("[data-testid=cal-timegrid] div")).find((d) => d.textContent === "14:00")!;
    return Math.max(Math.abs(block - slot), Math.abs(top(label) + 6 - slot));
  });
  await expect.poll(offsets).toBeLessThan(4);
  await expect(page.getByTestId("cal-event-exam")).toContainText("History essay exam");
  await expect(page.getByTestId("cal-event-task")).toContainText("Source analysis");
  await evidence(page, "07-calendar-week");

  await page.getByTestId("cal-view-month").click();
  await expect(page.locator(`[data-testid="cal-month-day"][data-date="${today}"]`)).toBeVisible();
  await evidence(page, "07-calendar-month");
  await page.locator(`[data-testid="cal-month-day"][data-date="${today}"]`).click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId("cal-view-day")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("cal-event-block")).toBeVisible();
  await evidence(page, "07-calendar-day");

  await page.getByTestId("cal-next").click();
  await expect(page.getByTestId("cal-event-block")).toHaveCount(0);
  await page.getByTestId("cal-today").click();
  await expect(page.getByTestId("cal-event-block")).toHaveCount(1);
});

test("start the timer from a planned block; the session is linked to the block", async ({ page }) => {
  await page.clock.install();
  await login(page, "blocktimer");
  await addSubject(page, "Spanish");
  const today = await dayFromToday(page, 0);

  await page.goto("/calendar/");
  await page.getByTestId("cal-new-block").click();
  await page.getByTestId("block-subject").selectOption({ label: "Spanish" });
  await page.getByTestId("block-title").fill("Verb drills");
  await page.getByTestId("block-date").fill(today);
  await page.getByTestId("block-start").fill("10:00");
  await page.getByTestId("block-end").fill("10:25");
  await page.getByTestId("block-start-timer").click();

  await expect(page).toHaveURL(/\/timer\/?$/);
  await expect(page.getByTestId("timer-active-block")).toContainText("Verb drills");
  await setGoalOnTimer(page);
  await page.getByTestId("timer-start").click();
  await page.clock.fastForward("25:30"); // focus period ends → session saved
  await expect(page.getByTestId("timer-active-block")).toContainText("25 of 25 min done", { timeout: 15_000 });
  await evidence(page, "08-timer-from-block");

  await page.goto("/today/");
  await expect(page.getByTestId("today-blocks")).toContainText("25/25 min");
  await page.goto("/sessions/");
  await expect(page.locator("main")).toContainText("Spanish");
});
