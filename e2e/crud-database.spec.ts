// Every add, edit and delete in the app is checked in the database itself
// (Firestore emulator), not only on screen.
import { test, expect, type Page } from "@playwright/test";
import { login, seedDoc, PROJECT } from "./helpers";
import { addSubject, dayFromToday } from "./helpers-data";

type Doc = Record<string, unknown> & { id: string };

function fromFs(v: Record<string, unknown>): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: Record<string, unknown>[] }).values ?? []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries((v.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {}).map(([k, x]) => [k, fromFs(x)]));
  return undefined;
}

/** All documents of users/{uid}/{col}, read straight from the database. */
async function db(uid: string, col: string): Promise<Doc[]> {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/${col}?pageSize=300`, { headers: { Authorization: "Bearer owner" } });
  const json = (await res.json()) as { documents?: { name: string; fields?: Record<string, Record<string, unknown>> }[] };
  return (json.documents ?? []).map((d) => ({ id: d.name.split("/").pop()!, ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, fromFs(v)])) }));
}

/** Waits until the database matches (writes reach the server a moment after the click). */
async function expectDb(uid: string, col: string, check: (docs: Doc[]) => boolean, what: string) {
  await expect.poll(async () => check(await db(uid, col)), { message: `database: ${col} — ${what}`, timeout: 10_000 }).toBe(true);
}

async function openSubject(page: Page, name: string): Promise<string> {
  await page.goto("/subjects/");
  await page.getByTestId("subject-open").filter({ hasText: name }).click();
  await expect(page.getByTestId("subject-name")).toHaveText(name);
  return new URL(page.url()).searchParams.get("id")!;
}

test.beforeEach(({ page }) => { page.on("dialog", (d) => d.accept()); });

test("database: subjects, topics, results, sessions and tasks (add, edit, delete; subject delete cascades)", async ({ page }) => {
  const { uid } = await login(page, "crud1");

  // Subject: add, rename
  await addSubject(page, "Maths");
  await expectDb(uid, "subjects", (d) => d.length === 1 && d[0].name === "Maths", "added");
  await page.getByTitle("Edit subject").click();
  await page.getByPlaceholder("e.g. Calculus II").fill("Mathematics");
  await page.getByPlaceholder("e.g. Calculus II").press("Enter");
  await expectDb(uid, "subjects", (d) => d[0]?.name === "Mathematics", "renamed");
  const subjectId = await openSubject(page, "Mathematics");

  // Topic: add, rename, check, delete
  await page.getByTestId("topic-input").fill("Limits");
  await page.getByTestId("topic-add").click();
  await expectDb(uid, "topics", (d) => d.length === 1 && d[0].title === "Limits" && d[0].subjectId === subjectId, "added");
  await page.getByTestId("topic-rename").click();
  await page.getByTestId("topic-rename-input").fill("Limits and continuity");
  await page.getByTestId("topic-rename-input").press("Enter");
  await expectDb(uid, "topics", (d) => d[0]?.title === "Limits and continuity", "renamed");
  await page.getByTestId("topic-check").click();
  await expectDb(uid, "topics", (d) => d[0]?.done === true, "checked");
  await page.getByTestId("topic-input").fill("Integrals");
  await page.getByTestId("topic-add").click();
  await expectDb(uid, "topics", (d) => d.length === 2, "second added");
  await page.getByRole("button", { name: "Delete Integrals" }).click();
  await expectDb(uid, "topics", (d) => d.length === 1 && d[0].title === "Limits and continuity", "deleted");

  // Result: add, edit, delete
  const panel = page.getByTestId("results-panel");
  await panel.getByTestId("result-title").fill("Quiz 1");
  await panel.getByTestId("result-score").fill("6");
  await panel.getByTestId("result-max").fill("10");
  await panel.getByTestId("result-add").click();
  await expectDb(uid, "results", (d) => d.length === 1 && d[0].score === 6 && d[0].maxScore === 10, "added");
  await panel.getByTestId("result-edit").click();
  await panel.getByTestId("result-score").fill("8");
  await panel.getByTestId("result-add").click();
  await expectDb(uid, "results", (d) => d.length === 1 && d[0].score === 8, "edited");
  await panel.getByTestId("result-add").waitFor();
  await panel.getByTestId("result-title").fill("Quiz 2");
  await panel.getByTestId("result-score").fill("70");
  await panel.getByTestId("result-max").fill("100");
  await panel.getByTestId("result-add").click();
  await expectDb(uid, "results", (d) => d.length === 2, "second added");
  await panel.getByRole("button", { name: "Delete Quiz 2" }).click();
  await expectDb(uid, "results", (d) => d.length === 1 && d[0].title === "Quiz 1", "deleted");

  // Session: edit and delete in Sessions (sessions are added by the timer; that is tested elsewhere)
  const today = await dayFromToday(page, 0);
  await seedDoc(uid, "sessions", { uid, subjectId, subjectName: "Mathematics", subjectColor: "violet", durationMinutes: 25, focusScore: 100, pomodoroCount: 1, date: today, startTime: "09:00", endTime: "09:25" }, "s1");
  await seedDoc(uid, "sessions", { uid, subjectId, subjectName: "Mathematics", subjectColor: "violet", durationMinutes: 10, focusScore: 100, pomodoroCount: 0, date: today, startTime: "11:00", endTime: "11:10" }, "s2");
  await page.goto("/sessions/");
  await page.getByRole("button", { name: /Edit session Mathematics 09:00/ }).click();
  const form = page.getByTestId("edit-session");
  await form.getByTestId("edit-session-topic").selectOption({ label: "✓ Limits and continuity" });
  await form.getByTestId("edit-session-minutes").fill("40");
  await form.getByTestId("edit-session-rating-3").click();
  await form.getByTestId("edit-session-distractions").fill("2");
  await form.getByTestId("edit-session-notes").fill("Fixed the length");
  await form.getByTestId("edit-session-save").click();
  await expectDb(uid, "sessions", (d) => {
    const s = d.find((x) => x.id === "s1");
    return !!s && s.durationMinutes === 40 && s.endTime === "09:40" && s.focusRating === 3 && s.distractions === 2 && s.topicTitle === "Limits and continuity" && s.notes === "Fixed the length";
  }, "edited");
  await expect(page.getByTestId("session-notes").first()).toBeVisible();
  await page.getByTitle("Delete session").last().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expectDb(uid, "sessions", (d) => d.length === 1, "deleted");

  // Task: add, edit, complete, delete
  await page.goto("/tasks/");
  await page.getByTestId("task-new").click();
  await page.getByTestId("task-title").fill("Problem set 3");
  await page.getByTestId("task-save").click();
  await expectDb(uid, "tasks", (d) => d.length === 1 && d[0].title === "Problem set 3" && d[0].completed === false, "added");
  await page.getByTestId("task-edit").click();
  await page.getByTestId("task-title").fill("Problem set 3 (all)");
  await page.getByTestId("task-save").click();
  await expectDb(uid, "tasks", (d) => d[0]?.title === "Problem set 3 (all)", "edited");
  await page.getByTestId("task-check").click();
  await expectDb(uid, "tasks", (d) => d[0]?.completed === true, "completed");
  await page.getByRole("button", { name: /^Done \(1\)/ }).click();
  await page.getByRole("button", { name: "Delete task" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expectDb(uid, "tasks", (d) => d.length === 0, "deleted");

  // Subject delete removes its topics, results and sessions too
  await page.goto("/subjects/");
  await page.getByTitle("Delete subject").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expectDb(uid, "subjects", (d) => d.length === 0, "deleted");
  await expectDb(uid, "topics", (d) => d.length === 0, "deleted with subject");
  await expectDb(uid, "results", (d) => d.length === 0, "deleted with subject");
  await expectDb(uid, "sessions", (d) => d.length === 0, "deleted with subject");
});

test("database: goals, exams, habits, classes, study blocks, decks, cards and the study target", async ({ page }) => {
  const { uid } = await login(page, "crud2");
  await addSubject(page, "Physics");
  const date = await dayFromToday(page, 7);

  // Goal
  await page.goto("/goals/");
  await page.getByRole("button", { name: /New Goal/ }).first().click();
  await page.getByPlaceholder("e.g. Weekly Study Goal").fill("Revise mechanics");
  await page.locator("select").filter({ hasText: "Select a subject" }).selectOption({ label: "Physics" });
  await page.getByRole("button", { name: /Create Goal|Save Goal|Add Goal/ }).click();
  await expectDb(uid, "goals", (d) => d.length === 1 && d[0].title === "Revise mechanics", "goal added");
  await page.getByTitle("Edit goal").click();
  await page.getByPlaceholder("e.g. Weekly Study Goal").fill("Revise all mechanics");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expectDb(uid, "goals", (d) => d[0]?.title === "Revise all mechanics", "goal edited");
  await page.getByTitle("Delete goal").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expectDb(uid, "goals", (d) => d.length === 0, "goal deleted");

  // Exam
  await page.goto("/exams/");
  await page.getByTestId("exam-new").click();
  await page.getByTestId("exam-title").fill("Physics midterm");
  await page.getByTestId("exam-date").fill(date);
  await page.getByTestId("exam-save").click();
  await expectDb(uid, "exams", (d) => d.length === 1 && d[0].title === "Physics midterm" && d[0].date === date, "exam added");
  await page.getByTestId("exam-edit").click();
  await page.getByTestId("exam-title").fill("Physics final");
  await page.getByTestId("exam-save").click();
  await expectDb(uid, "exams", (d) => d[0]?.title === "Physics final", "exam edited");
  await page.getByTestId("exam-edit").click();
  await page.getByRole("button", { name: "Delete exam" }).click();
  await expectDb(uid, "exams", (d) => d.length === 0, "exam deleted");

  // Habit
  await page.goto("/habits/");
  await page.getByTestId("habit-new").click();
  await page.getByTestId("habit-title").fill("Read 10 pages");
  await page.getByTestId("habit-save").click();
  await expectDb(uid, "habits", (d) => d.length === 1 && d[0].title === "Read 10 pages", "habit added");
  await page.getByTestId("habit-check").click();
  await expectDb(uid, "habits", (d) => Object.keys((d[0]?.log ?? {}) as object).length === 1, "habit checked");
  await page.getByRole("button", { name: "Read 10 pages" }).first().click();
  await page.getByTestId("habit-title").fill("Read 20 pages");
  await page.getByTestId("habit-save").click();
  await expectDb(uid, "habits", (d) => d[0]?.title === "Read 20 pages", "habit edited");
  await page.getByRole("button", { name: "Read 20 pages" }).first().click();
  await page.getByRole("button", { name: "Delete habit" }).click();
  await expectDb(uid, "habits", (d) => d.length === 0, "habit deleted");

  // Class (timetable)
  await page.goto("/timetable/");
  await page.getByTestId("class-new").click();
  await page.getByTestId("class-subject").selectOption({ label: "Physics" });
  await page.getByTestId("class-room").fill("Lab 1");
  await page.getByTestId("class-start").fill("10:00");
  await page.getByTestId("class-end").fill("11:00");
  await page.getByTestId("class-save").click();
  await expectDb(uid, "classes", (d) => d.length === 1 && d[0].room === "Lab 1", "class added");
  await page.getByTestId("tt-class").first().click();
  await page.getByTestId("class-room").fill("Lab 2");
  await page.getByTestId("class-save").click();
  await expectDb(uid, "classes", (d) => d[0]?.room === "Lab 2", "class edited");
  await page.getByTestId("tt-class").first().click();
  await page.getByRole("button", { name: "Delete class" }).click();
  await expectDb(uid, "classes", (d) => d.length === 0, "class deleted");

  // Study block (calendar)
  await page.goto("/calendar/");
  await page.getByTestId("cal-new-block").click();
  await page.getByTestId("block-subject").selectOption({ label: "Physics" });
  await page.getByTestId("block-title").fill("Waves");
  await page.getByTestId("block-date").fill(await dayFromToday(page, 0));
  await page.getByTestId("block-start").fill("15:00");
  await page.getByTestId("block-end").fill("16:00");
  await page.getByTestId("block-save").click();
  await expectDb(uid, "studyBlocks", (d) => d.length === 1 && d[0].title === "Waves", "block added");
  await page.getByTestId("cal-event-block").first().click();
  await page.getByTestId("block-title").fill("Waves and optics");
  await page.getByTestId("block-save").click();
  await expectDb(uid, "studyBlocks", (d) => d[0]?.title === "Waves and optics", "block edited");
  await page.getByTestId("cal-event-block").first().click();
  await page.getByRole("button", { name: "Delete block" }).click();
  await expectDb(uid, "studyBlocks", (d) => d.length === 0, "block deleted");

  // Deck and card
  await page.goto("/flashcards/");
  await page.getByTestId("deck-new").click();
  await page.getByTestId("deck-name").fill("Formulas");
  await page.getByTestId("deck-subject").selectOption({ label: "Physics" });
  await page.getByTestId("deck-save").click();
  await expectDb(uid, "decks", (d) => d.length === 1 && d[0].name === "Formulas", "deck added");
  await page.getByTestId("note-type-basic").click();
  await page.getByTestId("note-front").fill("F = ?");
  await page.getByTestId("note-back").fill("m·a");
  await page.getByTestId("note-save").click();
  await expectDb(uid, "notes", (d) => d.length === 1, "card added");
  await expectDb(uid, "cards", (d) => d.length === 1, "card scheduling added");
  await page.getByRole("button", { name: "Edit card" }).click();
  await page.getByTestId("note-front").last().fill("Newton's second law?");
  await page.getByTestId("note-save").last().click();
  await expectDb(uid, "notes", (d) => String((d[0]?.fields as { front?: string })?.front ?? "").includes("Newton"), "card edited");
  await page.getByRole("button", { name: "Delete card" }).click();
  await expectDb(uid, "notes", (d) => d.length === 0, "card deleted");
  await expectDb(uid, "cards", (d) => d.length === 0, "card scheduling deleted");
  await page.getByTestId("deck-settings").click();
  await page.getByTestId("deck-name").fill("Physics formulas");
  await page.getByTestId("deck-save").click();
  await expectDb(uid, "decks", (d) => d[0]?.name === "Physics formulas", "deck renamed");
  await page.getByTestId("deck-settings").click();
  await page.getByRole("button", { name: "Delete deck" }).click();
  await expectDb(uid, "decks", (d) => d.length === 0, "deck deleted");

  // Study target (always for a subject): set, change, remove
  await page.goto("/today/");
  const card = page.getByTestId("target-card");
  await card.getByTestId("subject-target-add").click();
  await card.getByTestId("subject-target-subject").selectOption({ label: "Physics" });
  await card.getByTestId("target-daily").fill("2");
  await card.getByTestId("target-save").click();
  await expectDb(uid, "subjects", (d) => d[0]?.dailyTargetMinutes === 120, "target set");
  await card.getByRole("button", { name: "Change Physics target" }).click();
  await card.getByTestId("target-daily").fill("");
  await card.getByTestId("target-weekly").fill("10");
  await card.getByTestId("target-save").click();
  await expectDb(uid, "subjects", (d) => d[0]?.dailyTargetMinutes === undefined && d[0]?.weeklyTargetMinutes === 600, "target changed");
  await card.getByTestId("subject-target-remove").click();
  await expectDb(uid, "subjects", (d) => d[0]?.weeklyTargetMinutes === undefined, "target removed");
});
