import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Late evening in a US time zone is already "tomorrow" in UTC. The app must use the local day.
test.use({ timezoneId: "America/Denver" });

test("late evening in Denver still logs today's date", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-24T05:30:00Z")); // 23:30 on Oct 23 in Denver
  await login(page, "tz");
  await page.getByRole("button", { name: /Log/ }).first().click();
  await expect(page.locator('input[type="date"]')).toHaveValue("2026-10-23");
});
