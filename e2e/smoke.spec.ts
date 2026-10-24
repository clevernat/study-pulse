import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";

test("log in and see the dashboard", async ({ page }) => {
  await login(page, "smoke");
  await expect(page.getByText(/Welcome back/)).toBeVisible();
  await evidence(page, "00-dashboard");
});
