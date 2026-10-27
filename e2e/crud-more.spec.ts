// The last things that could be added but not changed or removed: quick tasks,
// holidays, the total study target, your name, and an invite's role. Checked in the database.
import { test, expect } from "@playwright/test";
import { login, seedDoc, seedTop, PROJECT } from "./helpers";
import { dayFromToday } from "./helpers-data";

const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
async function get(path: string) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: "Bearer owner" } });
  return r.ok ? JSON.stringify(await r.json()) : "";
}

test("rename a quick task, change a holiday, remove the total target, change your name", async ({ page }) => {
  const { uid } = await login(page, "crudmore");

  // Quick task (top bar list): add, rename
  await page.getByTitle("Tasks").click();
  await page.getByPlaceholder("Add a task…").fill("Read ch 1");
  await page.getByPlaceholder("Add a task…").press("Enter");
  await page.getByTestId("quick-task-rename").first().click();
  await page.getByTestId("quick-task-rename-input").fill("Read chapters 1 and 2");
  await page.getByTestId("quick-task-rename-input").press("Enter");
  await expect.poll(() => get(`users/${uid}/tasks`)).toContain("Read chapters 1 and 2");
  await page.keyboard.press("Escape");

  // Holiday: add, then change its name and dates
  const [d1, d2] = [await dayFromToday(page, 10), await dayFromToday(page, 12)];
  await page.goto("/timetable/");
  await page.getByTestId("holiday-name").fill("Break");
  await page.getByTestId("holiday-start").fill(d1);
  await page.getByTestId("holiday-add").click();
  await page.getByTestId("holiday-edit").click();
  await page.getByTestId("holiday-name").fill("Mid-term break");
  await page.getByTestId("holiday-end").fill(d2);
  await page.getByTestId("holiday-add").click();
  await page.getByTestId("term-save").click();
  await expect.poll(() => get(`users/${uid}/preferences/timetable`)).toContain("Mid-term break");
  expect(await get(`users/${uid}/preferences/timetable`)).toContain(d2);

  // A target always needs a subject: with no subjects there is nothing to save
  await page.goto("/today/");
  await expect(page.getByTestId("target-card").getByTestId("target-form")).toHaveCount(0);
  await page.getByTestId("subject-target-add").click();
  await expect(page.getByTestId("subject-target-subject")).toHaveValue("");
  await expect(page.getByTestId("subject-target-new").getByTestId("target-form")).toHaveCount(0);

  // Your name
  await page.goto("/settings/");
  await page.getByTestId("name-edit").click();
  await page.getByTestId("name-input").fill("Ama Mensah");
  await page.getByTestId("name-save").click();
  await expect(page.getByTestId("name-value")).toHaveText("Ama Mensah");
  await expect.poll(() => get(`members/${uid}`)).toContain("Ama Mensah");
});

test("admin changes the role of a waiting invite", async ({ page }) => {
  await login(page, "crudadmin", "admin");
  const email = `wait-${Date.now()}@studypulse.test`;
  await seedTop(`invites/${email}`, { email, role: "user", invitedBy: "x", createdAt: Date.now() });
  await page.goto("/admin/people/");
  await page.getByTestId("invite-item").filter({ hasText: email }).getByTestId("role-admin").click();
  await expect.poll(() => get(`invites/${email}`)).toContain('"role":{"stringValue":"admin"}');
});

test("every edit form has a labelled Delete that removes the item from the database", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const { uid } = await login(page, "deleteforms");
  const count = async (col: string) => ((JSON.parse((await get(`users/${uid}/${col}`)) || "{}").documents ?? []) as unknown[]).length;
  const today = await dayFromToday(page, 0);
  const confirm = () => page.getByRole("button", { name: "Delete", exact: true }).click();

  // Subject (made with + New subject inside the task form), task, goal, result, session
  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.locator("select:has(option:text('+ New subject…'))").selectOption({ label: "+ New subject…" });
  await page.getByTestId("new-subject-name").fill("Networking");
  await page.getByTestId("new-subject-save").click();
  await page.getByTestId("task-title").fill("Lab 1");
  await page.getByTestId("task-save").click();
  await expect.poll(() => count("tasks")).toBe(1);
  await page.getByTestId("task-edit").click();
  await page.getByTestId("task-delete-in-form").click();
  await confirm();
  await expect.poll(() => count("tasks")).toBe(0);

  await page.goto("/goals/");
  await page.getByRole("button", { name: /New Goal/ }).first().click();
  await page.getByPlaceholder("e.g. Weekly Study Goal").fill("Subnetting");
  await page.locator("select").filter({ hasText: "Select a subject" }).selectOption({ label: "Networking" });
  await page.getByRole("button", { name: /Create Goal/ }).click();
  await expect.poll(() => count("goals")).toBe(1);
  await page.getByTitle("Edit goal").click();
  await page.getByTestId("goal-delete").click();
  await confirm();
  await expect.poll(() => count("goals")).toBe(0);

  const subjectId = JSON.parse(await get(`users/${uid}/subjects`)).documents[0].name.split("/").pop();
  await seedDoc(uid, "sessions", { uid, subjectId, subjectName: "Networking", subjectColor: "violet", durationMinutes: 25, focusScore: 100, pomodoroCount: 1, date: today, startTime: "09:00", endTime: "09:25" });
  await page.goto("/sessions/");
  await page.getByTestId("session-edit").click();
  await page.getByTestId("edit-session-delete").click();
  await confirm();
  await expect.poll(() => count("sessions")).toBe(0);

  await page.goto(`/subjects/view/?id=${subjectId}`);
  const panel = page.getByTestId("results-panel");
  await panel.getByTestId("result-title").fill("Quiz");
  await panel.getByTestId("result-score").fill("7");
  await panel.getByTestId("result-max").fill("10");
  await panel.getByTestId("result-add").click();
  await expect.poll(() => count("results")).toBe(1);
  await panel.getByTestId("result-edit").click();
  await panel.getByTestId("result-delete-editing").click();
  await expect.poll(() => count("results")).toBe(0);

  await page.goto("/subjects/");
  await page.getByRole("button", { name: "Edit Networking" }).click();
  await page.getByTestId("subject-delete").click();
  await confirm();
  await expect.poll(() => count("subjects")).toBe(0);
});
