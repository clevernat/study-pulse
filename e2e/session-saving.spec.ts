// A finished focus is ALWAYS saved, exactly once, even when the timer is open
// on two devices and the other one reaches the break first (the bug that lost
// an hour of study). Checked in the database.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { createUser, PROJECT } from "./helpers";
import { addSubject, setGoalOnTimer } from "./helpers-data";

const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
async function sessions(uid: string) {
  const r = await fetch(`${FS}/users/${uid}/sessions`, { headers: { Authorization: "Bearer owner" } });
  return (((await r.json()) as { documents?: { name: string; fields: Record<string, { integerValue?: string; stringValue?: string }> }[] }).documents ?? [])
    .map((d) => ({ id: d.name.split("/").pop()!, minutes: Number(d.fields.durationMinutes?.integerValue), subject: d.fields.subjectName?.stringValue, topic: d.fields.topicTitle?.stringValue }));
}
async function device(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.clock.install();
  await page.goto("/login/");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/today\/?$/);
  return page;
}

test("two devices: the other device reaches the break first; the focus is saved once", async ({ browser }) => {
  test.skip(test.info().project.name !== "laptop", "two browsers at laptop size are enough");
  const user = await createUser("twodev");
  const a = await device(browser, user.email, user.password);
  // Device A: subject, topic, goal, start a 25-minute focus
  await addSubject(a, "Networking");
  await a.goto("/timer/");
  await a.getByText("Select a Subject").first().click();
  await a.getByText("Networking").last().click();
  await a.getByTestId("timer-topic-new-input").fill("IP Protocols");
  await a.getByTestId("timer-topic-new-input").press("Enter");
  await setGoalOnTimer(a, "Learn Networking");
  await a.getByTestId("timer-start").click();
  await expect.poll(async () => {
    const r = await fetch(`${FS}/users/${user.uid}/timerState/current`, { headers: { Authorization: "Bearer owner" } });
    return ((await r.json()) as { fields?: { timerState?: { stringValue?: string } } }).fields?.timerState?.stringValue;
  }, { message: "device A saved the running timer" }).toBe("running");

  // Device B (phone, other tab…) sees the running timer
  const b = await device(browser, user.email, user.password);
  await expect(b.getByTestId("floating-timer")).toBeVisible();

  // B's clock reaches the end first → B switches to the break and tells A
  await b.clock.fastForward("25:30");
  await expect.poll(async () => (await sessions(user.uid)).length, { timeout: 15_000 }).toBe(1);
  // A catches up later: still one session, not two
  await a.clock.fastForward("25:30");
  await a.waitForTimeout(3000);
  const list = await sessions(user.uid);
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ minutes: 25, subject: "Networking", topic: "IP Protocols" });

  // And it shows: Today counts it, the goal moved
  await a.goto("/today/");
  await expect(a.getByTestId("goals-first-item")).toContainText("25 min of 2 hrs");
});

test("one device: a full 60-minute focus is saved as 60 minutes", async ({ page }) => {
  test.skip(test.info().project.name !== "laptop", "laptop is enough");
  await page.clock.install();
  const user = await createUser("hour");
  await page.goto("/login/");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/today\/?$/);
  await addSubject(page, "Networking");
  await page.goto("/timer/");
  await page.getByText("Select a Subject").first().click();
  await page.getByText("Networking").last().click();
  await page.getByRole("button", { name: "60m" }).first().click();
  await setGoalOnTimer(page);
  await page.getByTestId("timer-start").click();
  // Leave the timer page while it runs (like going to Today)
  await page.goto("/today/");
  await page.clock.fastForward("30:00");
  await expect(page.getByTestId("goals-first-item")).toContainText("30 min of 2 hrs"); // live
  await page.clock.fastForward("30:30");
  await expect.poll(async () => (await sessions(user.uid)).map((s) => s.minutes), { timeout: 15_000 }).toEqual([60]);
  await expect(page.getByTestId("goals-first-item")).toContainText("1 hr of 2 hrs");
});

test("app closed during the focus: reopening later still saves it", async ({ page }) => {
  test.skip(test.info().project.name !== "laptop", "laptop is enough");
  await page.clock.install();
  const user = await createUser("closed");
  await page.goto("/login/");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/today\/?$/);
  await addSubject(page, "Networking");
  await page.goto("/timer/");
  await page.getByText("Select a Subject").first().click();
  await page.getByText("Networking").last().click();
  await setGoalOnTimer(page);
  await page.getByTestId("timer-start").click();
  await page.goto("about:blank");          // app closed
  await page.clock.fastForward("40:00");   // focus (25) and break (5) end while away
  await page.goto("/today/");              // reopened
  await expect.poll(async () => (await sessions(user.uid)).map((s) => s.minutes), { timeout: 15_000 }).toEqual([25]);
});
