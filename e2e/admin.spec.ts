// Invite-only sign-up, username sign-in, the admin Team and People pages,
// and the progress summary each member's app writes.
import { test, expect, type Page } from "@playwright/test";
import { createUser, evidence, login, seedDoc, seedTop, PROJECT } from "./helpers";
import { addSubject, dayFromToday } from "./helpers-data";

const AUTH = "http://127.0.0.1:9099";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Opens the newest email-confirmation link the auth emulator "sent" to `email`. */
async function confirmEmail(email: string) {
  await expect.poll(async () => {
    const res = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`);
    const { oobCodes } = (await res.json()) as { oobCodes: { email: string; requestType: string; oobLink: string }[] };
    const code = oobCodes.filter((c) => c.email === email && c.requestType === "VERIFY_EMAIL").pop();
    if (!code) return false;
    await fetch(code.oobLink);
    return true;
  }).toBe(true);
}

async function getDocJson(path: string) {
  const res = await fetch(`${FS}/${path}`, { headers: { Authorization: "Bearer owner" } });
  return res.ok ? ((await res.json()) as { fields: Record<string, Record<string, unknown>> }).fields : null;
}

const unique = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function signUp(page: Page, email: string, username: string) {
  await page.goto("/login/?mode=signup");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill("Test1234!");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("access-gate")).toHaveAttribute("data-access", "unverified");
}

test("invited person signs up with a username, confirms the email, joins with the invited role and signs in with the username", async ({ page }) => {
  const email = `${unique("ama")}@studypulse.test`;
  const username = unique("ama").replace(/-/g, "_").slice(0, 20).toLowerCase();
  await seedTop(`invites/${email}`, { email, role: "user", invitedBy: "owner", createdAt: Date.now() });

  await signUp(page, email, username);
  await evidence(page, "40-confirm-email");
  await confirmEmail(email);
  await page.getByTestId("access-recheck").click();
  await expect(page).toHaveURL(/\/today\/?$/);

  // Joined in the database: member with the invite's role, username reserved, invite used up.
  await expect.poll(async () => (await getDocJson(`usernames/${username}`))?.email?.stringValue).toBe(email);
  const uid = (await getDocJson(`usernames/${username}`))!.uid.stringValue as string;
  expect((await getDocJson(`members/${uid}`))?.role?.stringValue).toBe("user");
  expect((await getDocJson(`invites/${email}`))).toBeNull();

  // No admin pages for a member.
  await expect(page.getByRole("link", { name: /Admin/ })).toHaveCount(0);
  await page.goto("/admin/");
  await expect(page.getByText("Admins only")).toBeVisible();

  // Sign out, then sign in with the username instead of the email.
  await page.getByTestId("account-menu").click();
  await page.getByTestId("account-signout").click();
  await page.goto("/login/");
  await page.getByTestId("login-email").fill(username);
  await page.getByTestId("login-password").fill("Test1234!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/today\/?$/);
});

test("someone without an invite is stopped after confirming the email", async ({ page }) => {
  const email = `${unique("eve")}@studypulse.test`;
  await signUp(page, email, unique("eve").replace(/-/g, "_").slice(0, 20));
  await confirmEmail(email);
  await page.getByTestId("access-recheck").click();
  await expect(page.getByTestId("access-gate")).toHaveAttribute("data-access", "no-invite");
  await expect(page.getByText("StudyPulse is invite only")).toBeVisible();
  await evidence(page, "41-invite-only");
});

test("admin: team progress, one person's details, invite, change role, remove", async ({ page }) => {
  const today = await dayFromToday(page, 0);
  // Two members with progress summaries, one who has not opened the app yet.
  const days = (list: number[]) => [...Array(14 - list.length).fill(0), ...list];
  const tag = Math.random().toString(36).slice(2, 6).toUpperCase(); // other tests share the emulator
  const [AMA, KOFI, YAW] = [`Ama ${tag}`, `Kofi ${tag}`, `Yaw ${tag}`];
  const ama = await createUser(AMA);
  const kofi = await createUser(KOFI);
  const yaw = await createUser(YAW);
  const base = { email: "", today, updatedAt: Date.now(), longestStreak: 5, distractionsPerHour: 0.5, goals: { active: 1, done: 2 }, nextExam: { title: "Biology final", date: await dayFromToday(page, 12) }, target: { daily: 60, weekly: 420 } };
  await seedTop(`progress/${ama.uid}`, { ...base, name: AMA, email: ama.email, totalMinutes: 1500, sessionCount: 30, days: days([30, 45, 60, 0, 50, 90, 75, 60, 40, 80]), thisWeek: 255, lastWeek: 180, streak: 4, rating: 4.4,
    subjects: [{ name: "Biology", color: "emerald", minutes: 900, weekMinutes: 200 }, { name: "Chemistry", color: "amber", minutes: 600, weekMinutes: 55 }],
    results: { count: 3, avgPct: 84 }, topics: { done: 8, total: 10 }, bestTime: { part: "Evening", weekday: "Tuesday" } });
  await seedTop(`progress/${kofi.uid}`, { ...base, name: KOFI, email: kofi.email, totalMinutes: 400, sessionCount: 12, days: days([60, 30, 0, 0, 0, 0, 0, 0, 0]), thisWeek: 0, lastWeek: 90, streak: 0, rating: 2.6,
    subjects: [{ name: "Maths", color: "blue", minutes: 400, weekMinutes: 0 }], results: { count: 2, avgPct: 45 }, topics: { done: 1, total: 6 }, bestTime: null, nextExam: null });

  const admin = await login(page, "Boss", "admin");
  if (await page.getByTestId("nav-admin").isVisible()) await page.getByTestId("nav-admin").click();
  else { await page.getByTestId("account-menu").click(); await page.getByTestId("account-admin").click(); } // phone
  await expect(page).toHaveURL(/\/admin\/?$/);
  // Other tests share this emulator, so look for these people, not exact counts.
  const card = (name: string) => page.getByTestId("team-card").filter({ hasText: name });
  await expect(page.getByTestId("kpi-people-value")).not.toHaveText("0");
  await expect(card(AMA)).toContainText("Up 42% on last week");
  await expect(card(AMA)).toContainText("6.6 hrs");
  await expect(page.getByTestId("team-needs")).toContainText(KOFI);
  await expect(card(YAW)).toContainText("Has not opened StudyPulse yet");
  await evidence(page, "42-admin-team");

  await card(AMA).click();
  const detail = page.getByTestId("member-detail");
  await expect(detail).toContainText("Biology final");
  await expect(detail).toContainText("Topics covered (8/10)");
  await expect(detail).toContainText("84%");
  await expect(detail).toContainText("Strong focus (4.4/5)");
  await evidence(page, "43-admin-member");
  await page.keyboard.press("Escape");

  // People: invite as admin, then change roles and remove.
  await page.getByTestId("tab-admin-people").click();
  const newEmail = `${unique("efua")}@studypulse.test`;
  await page.getByTestId("invite-email").fill(newEmail);
  await page.getByTestId("invite-role-admin").click();
  // The invite email goes through the Gmail script; here a fake one answers.
  const mails: { idToken: string; email: string; site: string }[] = [];
  await page.route("**/__mail", async (route) => { mails.push(JSON.parse(route.request().postData() ?? "{}")); await route.fulfill({ json: { ok: true } }); });
  await page.getByTestId("invite-send").click();
  await expect(page.getByTestId("invite-done")).toContainText(newEmail);
  await expect(page.getByTestId("invite-mail-status")).toContainText("We emailed them the sign-up link");
  expect(mails[0]).toMatchObject({ email: newEmail, site: "http://localhost:5050" });
  expect(mails[0].idToken.split(".")).toHaveLength(3);
  await expect(page.getByTestId("invite-item").filter({ hasText: newEmail })).toContainText("Admin");
  await expect.poll(async () => (await getDocJson(`invites/${newEmail}`))?.role?.stringValue).toBe("admin");

  const kofiRow = page.getByTestId("member-item").filter({ hasText: kofi.email });
  await kofiRow.getByTestId("role-admin").click();
  await expect.poll(async () => (await getDocJson(`members/${kofi.uid}`))?.role?.stringValue).toBe("admin");
  await expect(page.getByTestId("member-item").filter({ hasText: admin.email }).getByTestId("member-remove")).toBeDisabled();
  await evidence(page, "44-admin-people");

  await page.getByTestId("member-item").filter({ hasText: yaw.email }).getByTestId("member-remove").click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect.poll(async () => getDocJson(`members/${yaw.uid}`)).toBeNull();
  await expect(page.getByTestId("member-item").filter({ hasText: yaw.email })).toHaveCount(0);
});

test("a member's app keeps their progress summary up to date, and the dashboard shows strengths and goals ahead", async ({ page }) => {
  const user = await login(page, "prog");
  await addSubject(page, "History");
  const today = await dayFromToday(page, 0);
  for (const [n, rating] of [[0, 5], [-1, 4], [-2, 5]] as const) {
    await seedDoc(user.uid, "sessions", { uid: user.uid, subjectId: "x", subjectName: "History", subjectColor: "violet", durationMinutes: 50, focusScore: 100, pomodoroCount: 2, date: await dayFromToday(page, n), startTime: "18:00", endTime: "18:50", focusRating: rating });
  }
  await expect.poll(async () => (await getDocJson(`progress/${user.uid}`))?.totalMinutes?.integerValue, { timeout: 15_000 }).toBe("150");
  const p = await getDocJson(`progress/${user.uid}`);
  expect(p?.today?.stringValue).toBe(today);
  expect(p?.streak?.integerValue).toBe("3");
  expect(JSON.stringify(p)).not.toContain("notes");

  await page.goto("/dashboard/");
  await expect(page.getByTestId("strengths")).toContainText("3-day streak");
  await expect(page.getByTestId("strengths")).toContainText("Strong focus");
  await expect(page.getByTestId("goals-ahead")).toBeVisible();
  await evidence(page, "45-dashboard-strengths");
});
