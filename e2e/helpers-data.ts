import { expect, type Page } from "@playwright/test";

/** Adds a subject through the Subjects page UI. */
export async function addSubject(page: Page, name: string) {
  await page.goto("/subjects/");
  await page.getByRole("button", { name: "Add Subject" }).first().click();
  await page.getByPlaceholder("e.g. Calculus II").fill(name);
  await page.getByPlaceholder("e.g. Calculus II").press("Enter");
  await expect(page.getByTestId("subject-open").filter({ hasText: name })).toBeVisible();
}

/** Local "YYYY-MM-DD" n days from today, computed in the browser's time zone. */
export async function dayFromToday(page: Page, n: number): Promise<string> {
  return page.evaluate((days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, n);
}

/** On the Timer page: set a goal for the picked subject (the timer needs one before it starts). */
export async function setGoalOnTimer(page: Page, title = "Study goal") {
  await page.getByTestId("timer-set-goal").click();
  await page.getByPlaceholder(/^e\.g\. Master /).fill(title);
  await page.getByRole("button", { name: /Set Goal & Study/ }).click();
  await expect(page.getByTestId("timer-needs-goal")).toBeHidden();
}
