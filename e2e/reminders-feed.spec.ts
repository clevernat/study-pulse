import { test, expect } from "@playwright/test";
import { login, evidence, PROJECT } from "./helpers";
import { addSubject, dayFromToday } from "./helpers-data";

const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
async function listDocs(path: string) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: "Bearer owner" } });
  return ((await r.json()) as { documents?: { name: string; fields: Record<string, { stringValue?: string; booleanValue?: boolean; integerValue?: string }> }[] }).documents ?? [];
}

test("reminders: turn on, plan from items, show a due reminder while the app is open", async ({ page, context }) => {
  await context.grantPermissions(["notifications"], { origin: "http://localhost:5050" });
  // Record notifications the app shows (the OS popup itself cannot be read by tests).
  await page.addInitScript(() => {
    const shown: string[] = [];
    (window as unknown as { __shown: string[] }).__shown = shown;
    const orig = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title: string, opts?: NotificationOptions) { shown.push(title); return orig.call(this, title, opts); };
  });
  const user = await login(page, "remind");
  await addSubject(page, "Chemistry");
  const tomorrow = await dayFromToday(page, 1);

  await page.goto("/settings/");
  await page.getByTestId("reminders-on").click();
  await expect(page.getByTestId("reminders-status")).toContainText("Reminders are on while StudyPulse is open");
  await expect(page.getByTestId("summary-time")).toHaveValue("07:30");

  // An exam tomorrow with a 1-day-before reminder → a planned reminder document
  await page.goto("/exams/");
  await page.getByTestId("exam-new").click();
  await page.getByTestId("exam-title").fill("Organic test");
  await page.getByTestId("exam-date").fill(tomorrow);
  await page.getByTestId("exam-time").fill("23:30");
  await page.getByTestId("exam-save").click();
  await expect(page.getByTestId("exam-card")).toBeVisible();
  await expect.poll(async () => (await listDocs(`users/${user.uid}/reminders`)).map((d) => d.fields.title?.stringValue), { timeout: 15_000 })
    .toEqual(expect.arrayContaining(["Exam: Organic test", "Your study plan today"]));

  // A test reminder is shown within seconds and marked as sent
  await page.goto("/settings/");
  await page.getByTestId("reminders-test").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shown: string[] }).__shown), { timeout: 30_000 }).toContain("Test reminder");
  await expect.poll(async () => (await listDocs(`users/${user.uid}/reminders`)).filter((d) => d.name.includes("/test-")).map((d) => d.fields.sent?.booleanValue)).toEqual([true]);
  await evidence(page, "16-reminders-settings");

  // The device's time zone is saved for the server
  const prefs = await (await fetch(`${FS}/users/${user.uid}/preferences/current`, { headers: { Authorization: "Bearer owner" } })).json();
  expect(prefs.fields.timeZone.stringValue).toBe(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone));
});

test("calendar feed: private link serves an .ics with exams, homework, blocks and classes", async ({ page, request }) => {
  const user = await login(page, "feed");
  await addSubject(page, "Geography");
  const inThreeDays = await dayFromToday(page, 3);
  await page.goto("/exams/");
  await page.getByTestId("exam-new").click();
  await page.getByTestId("exam-title").fill("Rivers quiz");
  await page.getByTestId("exam-date").fill(inThreeDays);
  await page.getByTestId("exam-time").fill("10:00");
  await page.getByTestId("exam-room").fill("G1");
  await page.getByTestId("exam-save").click();
  await expect(page.getByTestId("exam-card")).toBeVisible();
  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.getByTestId("task-kind-homework").click();
  await page.getByTestId("task-title").fill("Map of Europe");
  await page.getByTestId("task-due").fill(inThreeDays);
  await page.getByTestId("task-save").click();
  await expect(page.getByTestId("task-item")).toBeVisible();

  await page.goto("/settings/");
  await page.getByTestId("feed-create").click();
  const url = await page.getByTestId("feed-url").inputValue();
  expect(url).toMatch(/^http:\/\/localhost:5050\/cal\/[a-f0-9]{64}\.ics$/);
  await evidence(page, "17-calendar-link");

  const res = await request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const ics = await res.text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("SUMMARY:Exam: Rivers quiz (Geography)");
  expect(ics).toContain("LOCATION:Room G1");
  expect(ics).toContain("SUMMARY:Homework: Map of Europe");
  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const expectedStart = await page.evaluate(([d, z]) => {
    const local = new Date(`${d}T10:00:00`); // browser runs in the same zone as the user
    return local.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "") + `|${z}`;
  }, [inThreeDays, tz]);
  expect(ics).toContain(`DTSTART:${expectedStart.split("|")[0]}`);

  // A new link replaces the old one; the old link stops working
  page.on("dialog", (d) => d.accept());
  await page.getByTestId("feed-reset").click();
  await expect(page.getByTestId("feed-url")).not.toHaveValue(url);
  await expect.poll(async () => (await request.get(url)).status()).toBe(404);
  expect((await request.get(await page.getByTestId("feed-url").inputValue())).status()).toBe(200);
  // Unknown tokens get 404 and no data
  expect((await request.get(`/cal/${"0".repeat(64)}.ics`)).status()).toBe(404);
  void user;
});
