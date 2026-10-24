import { test, expect } from "@playwright/test";
import { login, evidence, PROJECT } from "./helpers";

test("manifest and icons are valid for installing", async ({ page, request }) => {
  await page.goto("/login/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/today/");
  const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
  for (const icon of m.icons) expect((await request.get(icon.src)).headers()["content-type"]).toBe("image/png");
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href")).toBe("/icons/apple-touch-icon.png");
  expect(await page.locator('meta[name="theme-color"]').getAttribute("content")).toBe("#131316");
  expect(await page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').count()).toBeGreaterThan(0);
});

test("works offline: pages open, data shows, changes sync when back online", async ({ page, context }) => {
  const user = await login(page, "offline");
  // Wait for the service worker to control the page and finish caching.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.getByTestId("task-title").fill("Made online");
  await page.getByTestId("task-save").click();
  await expect(page.getByTestId("task-item")).toContainText("Made online");

  await context.setOffline(true);
  await page.goto("/today/");                 // served by the service worker
  await expect(page.getByTestId("offline-badge")).toBeVisible();
  await page.goto("/tasks/");
  await expect(page.getByTestId("task-item")).toContainText("Made online"); // from the offline cache
  await page.getByTestId("task-new").click();
  await page.getByTestId("task-title").fill("Made offline");
  await page.getByTestId("task-save").click();
  await expect(page.getByTestId("task-item").filter({ hasText: "Made offline" })).toBeVisible();
  await evidence(page, "14-offline");
  await page.goto("/flashcards/");           // a page not opened before also loads offline
  await expect(page.getByTestId("page-title")).toHaveText("Flashcards");

  // Back online: the offline task reaches the server.
  await context.setOffline(false);
  await expect.poll(async () => {
    const r = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/users/${user.uid}/tasks`, { headers: { Authorization: "Bearer owner" } });
    const j = (await r.json()) as { documents?: { fields: { title: { stringValue: string } } }[] };
    return (j.documents ?? []).map((d) => d.fields.title.stringValue).sort();
  }, { timeout: 20_000 }).toEqual(["Made offline", "Made online"]);
});

test("settings explain how to install", async ({ page }) => {
  await login(page, "install");
  await page.goto("/settings/");
  await expect(page.getByTestId("install-card")).toBeVisible();
  await expect(page.getByTestId("install-card")).toContainText(/Install|installed/);
  await evidence(page, "15-install-card");
});
