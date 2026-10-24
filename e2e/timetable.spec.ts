import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";
import { addSubject, dayFromToday } from "./helpers-data";

test("timetable: weekly class, A/B weeks, holiday, exam clash, Today", async ({ page }) => {
  await login(page, "timetable");
  await addSubject(page, "Physics");
  await addSubject(page, "Chemistry");
  const today = await dayFromToday(page, 0);
  const weekday = await page.evaluate(() => new Date().getDay());

  // A/B rotation, this week = A
  await page.goto("/timetable/");
  await page.getByTestId("rotation-weeks").selectOption("2");
  await page.getByTestId("rotation-start").fill(today);
  await page.getByTestId("term-save").click();
  await expect(page.getByTestId("term-save")).toHaveText("Saved ✓");
  await expect(page.getByTestId("tt-week-label")).toContainText("Week A");

  // Physics every week today 10:00-11:00
  await page.getByTestId("class-new").click();
  await page.getByTestId("class-subject").selectOption({ label: "Physics" });
  await page.getByTestId("class-room").fill("Lab 3");
  await page.getByTestId("class-day").selectOption(String(weekday));
  await page.getByTestId("class-start").fill("10:00");
  await page.getByTestId("class-end").fill("11:00");
  await page.getByTestId("class-save").click();

  // Chemistry only in week B, same weekday
  await page.getByTestId("class-new").click();
  await page.getByTestId("class-subject").selectOption({ label: "Chemistry" });
  await page.getByTestId("class-day").selectOption(String(weekday));
  await page.getByTestId("class-start").fill("13:00");
  await page.getByTestId("class-end").fill("14:00");
  await page.getByTestId("class-week").selectOption("2");
  await page.getByTestId("class-save").click();

  await expect(page.getByTestId("tt-class")).toHaveCount(1);
  await expect(page.getByTestId("tt-class")).toContainText("Physics");
  await evidence(page, "06-timetable-week-a");
  await page.getByTestId("tt-next").click();
  await expect(page.getByTestId("tt-week-label")).toContainText("Week B");
  await expect(page.getByTestId("tt-class")).toHaveCount(2);
  await expect(page.getByTestId("tt-class").filter({ hasText: "Chemistry" })).toBeVisible();

  // Today shows the class
  await page.goto("/today/");
  await expect(page.getByTestId("today-classes")).toContainText("Physics");
  await expect(page.getByTestId("today-classes")).toContainText("Room Lab 3");

  // Exam at 10:30 next week (same weekday, week B) clashes with Physics
  const nextWeek = await dayFromToday(page, 7);
  await page.goto("/exams/");
  await page.getByTestId("exam-new").click();
  await page.getByTestId("exam-subject").selectOption({ label: "Chemistry" });
  await page.getByTestId("exam-title").fill("Chem test");
  await page.getByTestId("exam-date").fill(nextWeek);
  await page.getByTestId("exam-time").fill("10:30");
  await page.getByTestId("exam-save").click();
  await expect(page.getByTestId("exam-clash")).toContainText("Clashes with Physics 10:00–11:00");
  await evidence(page, "06-exam-clash");

  // A holiday today removes today's classes
  await page.goto("/timetable/");
  await page.getByTestId("holiday-name").fill("Day off");
  await page.getByTestId("holiday-start").fill(today);
  await page.getByTestId("holiday-add").click();
  await page.getByTestId("term-save").click();
  await expect(page.getByTestId("term-save")).toHaveText("Saved ✓");
  await page.goto("/today/");
  await expect(page.getByTestId("today-classes")).toContainText("Day off: no classes.");
  await expect(page.getByTestId("today-classes")).not.toContainText("Physics");
});
