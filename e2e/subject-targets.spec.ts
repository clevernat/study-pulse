// A study target for one subject: set on Today, shown on the Timer and Progress, saved on the subject.
import { test, expect } from "@playwright/test";
import { evidence, login, seedDoc, PROJECT } from "./helpers";
import { dayFromToday } from "./helpers-data";

const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
async function subjectFields(uid: string) {
  const r = await fetch(`${FS}/users/${uid}/subjects`, { headers: { Authorization: "Bearer owner" } });
  return (((await r.json()) as { documents?: { name: string; fields: Record<string, { stringValue?: string; integerValue?: string }> }[] }).documents ?? [])
    .map((d) => ({ id: d.name.split("/").pop()!, name: d.fields.name.stringValue, weekly: d.fields.weeklyTargetMinutes?.integerValue, daily: d.fields.dailyTargetMinutes?.integerValue }));
}

test("subject target: add with a new subject, see it on Today, Timer and Progress, then remove it", async ({ page }) => {
  const { uid } = await login(page, "subtarget");
  await page.goto("/today/");
  const card = page.getByTestId("subject-targets");
  await card.getByTestId("subject-target-add").click();
  await card.getByTestId("subject-target-subject").selectOption({ label: "+ New subject…" });
  await page.getByTestId("new-subject-name").fill("Biology");
  await page.getByTestId("new-subject-save").click();
  await expect(card.getByTestId("subject-target-subject").locator("option:checked")).toHaveText("Biology");
  await card.getByTestId("subject-target-new").getByTestId("target-weekly").fill("5");
  await card.getByTestId("subject-target-new").getByTestId("target-save").click();
  const row = card.getByTestId("subject-target").filter({ hasText: "Biology" });
  await expect(row).toContainText("of 5 hrs");
  await expect.poll(async () => (await subjectFields(uid))[0]?.weekly).toBe("300");

  // A Biology session counts toward it
  const id = (await subjectFields(uid))[0].id;
  await seedDoc(uid, "sessions", { uid, subjectId: id, subjectName: "Biology", subjectColor: "violet", durationMinutes: 90, focusScore: 100, pomodoroCount: 1, date: await dayFromToday(page, 0), startTime: "09:00", endTime: "10:30" });
  await expect(row).toContainText("1.5 hrs");
  await evidence(page, "46-subject-target");

  // "Start studying" opens the Timer with that subject picked
  await row.getByTestId("subject-target-start").click();
  await expect(page).toHaveURL(/\/timer\/?\?subjectId=/);
  await expect(page.getByTestId("timer-subject-target")).toContainText("1.5 hrs / 5 hrs");

  await page.goto("/dashboard/");
  await expect(page.getByTestId("goals-subject-targets")).toContainText("Biology");

  await page.goto("/today/");
  await page.getByTestId("subject-target-remove").click();
  await expect(page.getByTestId("subject-target")).toHaveCount(0);
  await expect.poll(async () => (await subjectFields(uid))[0]?.weekly).toBeUndefined();
});
