import { test, expect } from "@playwright/test";
import { login, evidence, seedDoc } from "./helpers";

test("habits: daily check-in, amount goal, automatic study habit, streak", async ({ page }) => {
  const user = await login(page, "habits");
  await page.goto("/habits/");

  await page.getByTestId("habit-new").click();
  await page.getByTestId("habit-title").fill("Read 10 pages");
  await page.getByTestId("habit-save").click();
  const read = page.getByTestId("habit-item").filter({ hasText: "Read 10 pages" });
  await expect(read.getByTestId("habit-streak")).toHaveText(/0 days/);
  await read.getByTestId("habit-check").click();
  await expect(read.getByTestId("habit-check")).toHaveAttribute("aria-pressed", "true");
  await expect(read.getByTestId("habit-streak")).toHaveText(/1 day$/);

  await page.getByTestId("habit-new").click();
  await page.getByTestId("habit-title").fill("Drink water");
  await page.getByTestId("habit-target").fill("3");
  await page.getByTestId("habit-save").click();
  const water = page.getByTestId("habit-item").filter({ hasText: "Drink water" });
  for (let i = 0; i < 3; i++) await water.getByTestId("habit-plus").click();
  await expect(water.getByTestId("habit-streak")).toHaveText(/1 day$/);

  await page.getByTestId("habit-new").click();
  await page.getByTestId("habit-title").fill("Study 20 minutes");
  await page.getByTestId("habit-auto").selectOption("studyMinutes");
  await page.getByTestId("habit-target").fill("20");
  await page.getByTestId("habit-save").click();
  const study = page.getByTestId("habit-item").filter({ hasText: "Study 20 minutes" });
  await expect(study.getByTestId("habit-streak")).toHaveText(/0 days/);

  // A 25-minute study session today → the automatic habit is done
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  await seedDoc(user.uid, "sessions", { uid: user.uid, subjectId: "x", subjectName: "Maths", subjectColor: "violet", durationMinutes: 25,
    focusScore: 100, pomodoroCount: 1, date: today, startTime: "08:00", endTime: "08:25" });
  await expect(study.getByTestId("habit-streak")).toHaveText(/1 day$/);
  await evidence(page, "09-habits");

  // Habits also appear on Today
  await page.goto("/today/");
  await expect(page.getByTestId("today-habits").getByTestId("habit-item")).toHaveCount(3);
});
