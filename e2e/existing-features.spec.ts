import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";
import { addSubject } from "./helpers-data";

// The features StudyPulse had before the upgrade still work.
test("old features: log session, sessions list, dashboard, goals, reports, sounds, tasks popover, export", async ({ page }) => {
  await login(page, "oldfeatures");
  await addSubject(page, "History");

  // Manual "Log Session"
  await page.getByRole("button", { name: /Log/ }).first().click();
  // No subject click: the only subject is picked by default.
  await page.locator('input[type="number"]').nth(1).fill("45");
  await page.getByPlaceholder("What did you cover? Any blockers?").fill("Chapter 2");
  await page.locator("form").getByRole("button", { name: "Log Session" }).click();
  await expect(page.getByPlaceholder("What did you cover? Any blockers?")).toBeHidden(); // saved, form closed

  // Sessions page lists it; dashboard counts it
  await page.goto("/sessions/");
  await expect(page.locator("main")).toContainText("History");
  await expect(page.locator("main")).toContainText("45");
  await page.goto("/dashboard/");
  await expect(page.locator("main")).toContainText("Current streak1 day");
  await expect(page.locator("main")).toContainText("45 min");
  await expect(page.locator("main")).toContainText("First session"); // badge

  // Goals: create one, progress comes from the session
  await page.goto("/goals/");
  await page.getByRole("button", { name: /New Goal/ }).click();
  await page.getByPlaceholder("e.g. Weekly Study Goal").fill("Read history");
  await page.locator("select").filter({ hasText: "Select a subject" }).selectOption({ label: "History" });
  await page.getByRole("button", { name: /Create Goal|Save Goal|Add Goal/ }).click();
  await expect(page.locator("main")).toContainText("1 active");   // shown once, not twice
  await expect(page.locator("main")).toContainText("45 min / 2h target");

  // Reports show the session
  await page.goto("/reports/");
  await expect(page.locator("main")).toContainText("History");

  // Ambient sounds popover: play and stop rain
  await page.getByTitle("Relaxation sounds").click();
  await page.getByRole("button", { name: "Play Rain" }).click();
  await expect(page.getByRole("button", { name: "Stop Rain" })).toBeVisible();
  await page.getByRole("button", { name: "Stop Rain" }).click();
  await page.keyboard.press("Escape");

  // Tasks popover in the top bar
  await page.getByTitle("Tasks").click();
  await page.getByPlaceholder("Add a task…").fill("Popover task");
  await page.getByPlaceholder("Add a task…").press("Enter");
  await expect(page.getByText("Popover task")).toBeVisible();
  await page.goto("/tasks/");
  await expect(page.getByTestId("task-item")).toContainText("Popover task");

  // Export CSV and JSON from Settings
  await page.goto("/settings/");
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /CSV/ }).click()]);
  expect(csv.suggestedFilename()).toBe("studypulse-sessions.csv");
  const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /JSON/ }).click()]);
  expect(json.suggestedFilename()).toBe("studypulse-sessions.json");
  await evidence(page, "18-old-features-settings");
});

test("old features: Pomodoro timer, floating timer on other pages, reflection after a focus period", async ({ page, isMobile }) => {
  await page.clock.install();
  await login(page, "oldtimer");
  await addSubject(page, "Physics");
  await page.goto("/timer/");
  await page.getByText("Select a Subject").first().click();
  await page.getByText("Physics").last().click();
  await page.getByTestId("timer-start").click();
  await page.getByTestId(isMobile ? "bottom-nav-today" : "nav-today").click();
  await expect(page.getByTestId("floating-timer")).toBeVisible();
  await evidence(page, "18-floating-timer");
  await page.clock.fastForward("25:30");
  await expect(page.getByText("What did you work on? What did you get done?")).toBeVisible({ timeout: 15_000 });
  await page.goto("/sessions/");
  await expect(page.locator("main")).toContainText("Physics");
});

test("timer: stopping a focus early with Reset keeps the time studied (not under 1 minute)", async ({ page }) => {
  await page.clock.install();
  await login(page, "earlystop");
  await addSubject(page, "Chemistry");
  await page.goto("/timer/");
  await page.getByText("Select a Subject").first().click();
  await page.getByText("Chemistry").last().click();

  // A misclick (a few seconds) is not saved.
  await page.getByTestId("timer-start").click();
  await page.clock.fastForward("00:20");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("What did you work on? What did you get done?")).toBeHidden();

  // 10 minutes of a 25-minute focus, then Reset: saved as 10 min.
  await page.getByTestId("timer-start").click();
  await page.clock.fastForward("10:00");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("What did you work on? What did you get done?")).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder(/Finished the intro section/).fill("Acids and bases, 12 problems");
  await page.getByRole("button", { name: "Save Reflection" }).click();
  await expect(page.getByText("What did you work on? What did you get done?")).toBeHidden(); // saved
  await page.goto("/sessions/");
  await expect(page.locator("main")).toContainText("Chemistry");
  await expect(page.locator("main")).toContainText("10 min");
  // The reflection is shown with the session.
  await expect(page.getByTestId("session-notes")).toHaveText("Acids and bases, 12 problems");
});
