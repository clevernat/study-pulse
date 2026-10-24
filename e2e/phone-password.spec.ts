import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Settings → "Phone app sign-in": the phone app signs in with email + password.
test("settings change the password used by the phone app", async ({ page }) => {
  const user = await login(page, "phonepw");
  await page.goto("/settings/");
  const card = page.getByTestId("phone-password-card");
  await expect(card).toContainText(user.email);

  await card.getByLabel("New password").fill("short");
  await card.getByLabel("Type it again").fill("short");
  await card.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByTestId("phone-password-status")).toHaveText("Use at least 8 characters.");

  await card.getByLabel("New password").fill("phone-pass-123");
  await card.getByLabel("Type it again").fill("phone-pass-124");
  await card.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByTestId("phone-password-status")).toHaveText("The two passwords are not the same.");

  await card.getByLabel("Type it again").fill("phone-pass-123");
  await card.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByTestId("phone-password-status")).toContainText("Saved.");

  // The new password works (what the phone app does to sign in).
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: "phone-pass-123", returnSecureToken: true }),
  });
  expect(res.ok).toBe(true);
});
