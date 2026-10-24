import { test, expect } from "@playwright/test";
import { login, evidence } from "./helpers";

test("landing page has no made-up numbers, reviews or AI claims", async ({ page }) => {
  await page.goto("/");
  const text = await page.locator("body").innerText();
  for (const bad of ["10,000", "10K", "4.9", "10,247", "What students say", "AI-powered", "AI-Powered", "academic elite"]) {
    expect(text).not.toContain(bad);
  }
  await expect(page.getByText("Study and planning in one app")).toBeVisible();
  await evidence(page, "02-landing");
  expect(await page.title()).not.toContain("AI");
});

test("login page has no made-up numbers", async ({ page }) => {
  await page.goto("/login/");
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("10K");
  expect(text).not.toContain("4.9");
});

test("the word 'Subjects' is used everywhere (no 'Focus Area')", async ({ page }) => {
  await login(page, "naming");
  for (const path of ["/dashboard/", "/subjects/", "/timer/", "/tasks/", "/goals/", "/reports/", "/settings/"]) {
    await page.goto(path);
    await expect(page.getByTestId("page-title")).toBeVisible();
    expect(await page.locator("body").innerText(), path).not.toMatch(/focus area/i);
  }
});

test("every page can be reached from the menu", async ({ page, isMobile }) => {
  await login(page, "nav");
  const pages = ["/today", "/tasks", "/timer", "/subjects", "/sessions", "/goals", "/reports", "/settings", "/dashboard"];
  for (const href of pages) {
    if (isMobile) {
      await page.getByTestId("bottom-more").click();
      await expect(page.getByTestId("more-sheet")).toBeVisible();
      if (href === "/reports") await evidence(page, "02-more-sheet");
      await page.getByTestId(`more-nav${href.replace(/\//g, "-")}`).click();
    } else {
      await page.getByTestId(`nav${href.replace(/\//g, "-")}`).click();
    }
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
  }
});

test("phone header shows the full page title", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await login(page, "header");
  await page.goto("/dashboard/");
  const title = page.getByTestId("page-title");
  await expect(title).toHaveText("Dashboard");
  const box = await title.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(box.scroll).toBeLessThanOrEqual(box.client);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await evidence(page, "02-dashboard");
});

test("Log Session uses today's local date", async ({ page }) => {
  await login(page, "logdate");
  await page.getByRole("button", { name: /Log/ }).first().click();
  const expected = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(page.locator('input[type="date"]')).toHaveValue(expected);
});
