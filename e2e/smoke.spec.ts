import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";

test("log in and land on Today", async ({ page }) => {
  await login(page, "smoke");
  await expect(page.getByText(/on your plate today/)).toBeVisible();
  await evidence(page, "00-dashboard");
});
