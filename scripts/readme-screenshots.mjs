// Makes the README pictures with sample data, on the local emulators only.
// Run: npm run docs:screenshots   (builds the test app, starts emulators, runs this)
// Output: docs/images/*.png
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:5050";
const P = "demo-studypulse";
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
// SHOT_OUT=dir changes the folder; SHOT_ALL=1 shoots every page (full height) for design review.
const OUT = process.env.SHOT_OUT || "docs/images";
mkdirSync(OUT, { recursive: true });

// ── Sample data (made up, clearly a demo) ────────────────────────────────────
const toFs = (v) => v === null ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const writes = [];
const put = (path, data) => writes.push({ update: { name: `projects/${P}/databases/(default)/documents/${path}`, fields: toFs(data).mapValue.fields } });
async function commit() {
  for (let i = 0; i < writes.length; i += 400) {
    const r = await fetch(`${FS}:commit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
    if (!r.ok) throw new Error(await r.text());
  }
}
const pad = (n) => String(n).padStart(2, "0");
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const now = Date.now();
const DAY = 86_400_000;

const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "sam@studypulse.test", password: "Demo1234!", displayName: "Sam", returnSecureToken: true }),
});
const { localId: uid } = await res.json();
const u = `users/${uid}`;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

put(`${u}/preferences/current`, { pomodoroLength: 25, shortBreak: 5, longBreak: 15, timeZone: tz });
const subjects = [
  ["bio", "Biology", "biotech", "emerald", "SCI"], ["chem", "Chemistry", "science", "violet", "SCI"],
  ["math", "Calculus", "calculate", "amber", "MATH"], ["span", "Spanish", "translate", "rose", "LANG"],
];
for (const [id, name, icon, color, category] of subjects) put(`${u}/subjects/${id}`, { uid, name, icon, color, category, totalMinutes: 0, sessionCount: 0, createdAt: day(-60) });

// 45 days of study sessions (a 12-day streak, varied minutes)
let s = 0;
for (let i = 44; i >= 0; i--) {
  if (i > 12 && (i % 5 === 0 || i % 7 === 3)) continue;
  const count = 1 + ((i * 7) % 3);
  for (let k = 0; k < count; k++) {
    const [id, name, , color] = subjects[(i + k) % 4];
    const mins = [25, 25, 50, 45, 30, 60][(i + k) % 6];
    const start = 8 + ((i + k * 4) % 11) ;
    const endMin = start * 60 + mins;
    put(`${u}/sessions/s${s++}`, { uid, subjectId: id, subjectName: name, subjectColor: color, durationMinutes: mins, focusScore: 80 + ((i * 3 + k) % 21),
      pomodoroCount: Math.max(1, Math.round(mins / 25)), sessionType: k % 2 ? "Reading" : "Deep Work", date: day(-i), startTime: `${pad(start)}:00`, endTime: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`, notes: "" });
  }
}
// Topics, exams, tasks
["Cell structure", "Membranes", "Mitosis & meiosis", "Genetics", "Evolution", "Ecology"].forEach((t, i) =>
  put(`${u}/topics/t${i}`, { subjectId: "bio", title: t, done: i < 3, order: i, examId: i < 5 ? "e1" : null, createdAt: 1 }));
put(`${u}/exams/e1`, { subjectId: "bio", title: "Biology midterm", date: day(5), startTime: "09:00", durationMinutes: 90, room: "Hall B", seat: "42", reminderMinutesBefore: 1440, createdAt: 1 });
put(`${u}/exams/e2`, { subjectId: "chem", title: "Organic chemistry quiz", date: day(12), startTime: "14:00", durationMinutes: 45, room: "Lab 2", createdAt: 2 });
put(`${u}/exams/e3`, { subjectId: "math", title: "Calculus final", date: day(26), startTime: "10:00", durationMinutes: 120, createdAt: 3 });
const tasks = [
  ["Lab report: enzymes", "homework", "chem", 1, "17:00", "high"], ["Problem set 7", "homework", "math", 0, null, "medium"],
  ["Revise cell division", "revision", "bio", 2, null, "high"], ["Spanish vocab list 4", "task", "span", 3, null, "low"],
];
tasks.forEach(([title, kind, sid, d, time, priority], i) => put(`${u}/tasks/k${i}`, { uid, title, kind, subjectId: sid, subjectName: subjects.find((x) => x[0] === sid)[1],
  completed: false, dueDate: day(d), ...(time ? { dueTime: time } : {}), priority, ...(kind === "revision" ? { examId: "e1" } : {}), createdAt: new Date().toISOString() }));
// Weekly timetable (Mon–Fri)
put(`${u}/classes/c1`, { subjectId: "bio", title: "Lecture", room: "204", teacher: "Dr. Mensah", slots: [{ weekday: 1, start: "09:00", end: "10:30" }, { weekday: 3, start: "09:00", end: "10:30" }], createdAt: 1 });
put(`${u}/classes/c2`, { subjectId: "chem", title: "Lab", room: "Lab 2", slots: [{ weekday: 2, start: "13:00", end: "15:00" }], createdAt: 2 });
put(`${u}/classes/c3`, { subjectId: "math", title: "Lecture", room: "101", slots: [{ weekday: 1, start: "11:00", end: "12:00" }, { weekday: 4, start: "11:00", end: "12:00" }], createdAt: 3 });
put(`${u}/classes/c4`, { subjectId: "span", room: "12", slots: [{ weekday: 5, start: "10:00", end: "11:00" }, { weekday: 2, start: "09:00", end: "10:00" }], createdAt: 4 });
put(`${u}/preferences/timetable`, { rotationWeeks: 1, holidays: [] });
// Study blocks this week
[[0, "16:00", "17:00", "bio", "Read chapter 5"], [1, "15:00", "16:30", "math", "Practice integrals"], [-1, "18:00", "19:00", "span", "Speaking practice"], [2, "16:00", "17:00", "chem", "Review reactions"]]
  .forEach(([d, start, end, sid, title], i) => put(`${u}/studyBlocks/b${i}`, { title, subjectId: sid, date: day(d), start, end, minutesDone: d < 0 ? 60 : 0, createdAt: 1 }));
// Habits with history
const log = (every) => Object.fromEntries(Array.from({ length: 30 }, (_, i) => [day(-i), i % every === 0 ? 0 : 1]).filter(([, v]) => v).map(([d]) => [d, 1]));
put(`${u}/habits/h1`, { title: "Read 10 pages", icon: "menu_book", color: "violet", schedule: { type: "daily" }, target: 1, log: { ...log(9), [day(0)]: 1 }, createdAt: 1 });
put(`${u}/habits/h2`, { title: "Review flashcards", icon: "style", color: "emerald", schedule: { type: "daily" }, target: 20, unit: "cards", autoSource: "cardsReviewed", log: {}, createdAt: 2 });
put(`${u}/habits/h3`, { title: "Gym", icon: "fitness_center", color: "amber", schedule: { type: "weekly", timesPerWeek: 3 }, target: 1, log: log(2), createdAt: 3 });
// Flashcards: a deck with review cards due today and new cards
put(`${u}/decks/d1`, { name: "Cell Biology", subjectId: "bio", newPerDay: 10, reviewsPerDay: 200, retention: 0.9, createdAt: 1 });
put(`${u}/decks/d2`, { name: "Spanish verbs", subjectId: "span", newPerDay: 15, reviewsPerDay: 200, retention: 0.9, createdAt: 2 });
const notes = [
  ["cloze", { text: "The {{c1::mitochondria}} make most of the cell's {{c2::ATP}}.", extra: "Cellular respiration" }],
  ["basic", { front: "What does the cell membrane control?", back: "What goes in and out of the cell (it is selectively permeable)." }],
  ["basic", { front: "Where does photosynthesis happen?", back: "In the chloroplasts." }],
  ["cloze", { text: "DNA is copied during the {{c1::S phase}} of the cell cycle.", extra: "" }],
  ["basic", { front: "Name the 4 phases of mitosis.", back: "Prophase, metaphase, anaphase, telophase." }],
];
let c = 0;
notes.forEach(([type, fields], i) => {
  put(`${u}/notes/n${i}`, { deckId: "d1", subjectId: "bio", type, fields, tags: ["cells"], createdAt: i });
  const ords = type === "cloze" ? (fields.text.includes("c2::") ? [1, 2] : [1]) : [0];
  ords.forEach((ord, j) => {
    const review = (i + j) % 3 !== 2;
    put(`${u}/cards/c${c++}`, { noteId: `n${i}`, deckId: "d1", ord, createdAt: i * 10 + j, suspended: false, buriedUntil: null, learning_steps: 0,
      ...(review ? { state: 2, due: now - DAY * (j + 1), stability: 6, difficulty: 5, scheduled_days: 5 + i * 4, reps: 4, lapses: 0, last_review: now - DAY * 7 }
        : { state: 0, due: now, stability: 0, difficulty: 0, scheduled_days: 0, reps: 0, lapses: 0, last_review: null }) });
  });
});
for (let i = 0; i < 40; i++) put(`${u}/cards/f${i}`, { noteId: `n${i % 5}`, deckId: "d1", ord: 9, createdAt: 100 + i, suspended: false, buriedUntil: null, learning_steps: 0,
  state: 2, due: now + DAY * (1 + (i % 25)), stability: 10, difficulty: 5, scheduled_days: 10 + i, reps: 5, lapses: 0, last_review: now - DAY * 5 });
for (let i = 0; i < 60; i++) {
  if (i % 6 === 4) continue;
  const n = 15 + ((i * 13) % 40);
  put(`${u}/reviewDays/${day(-i - 1)}`, { count: n, ms: n * 9000, again: Math.round(n * 0.12), retPass: Math.round(n * 0.5), retTotal: Math.round(n * 0.56) });
}
await commit();

// ── Screenshots ──────────────────────────────────────────────────────────────
const browser = await chromium.launch({ channel: "chromium" });
async function shoot(viewport, scale, list) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: "dark", isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login/`);
  await page.getByTestId("login-email").fill("sam@studypulse.test");
  await page.getByTestId("login-password").fill("Demo1234!");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/dashboard|today/);
  for (const [name, path, prepare] of list) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(1500);
    if (prepare) await prepare(page);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!process.env.SHOT_ALL });
    console.log("saved", name);
  }
  await ctx.close();
}
if (process.env.SHOT_ALL) {
  const pages = process.env.SHOT_PAGES ? process.env.SHOT_PAGES.split(",") : ["/today/", "/dashboard/", "/calendar/", "/tasks/", "/exams/", "/timetable/", "/habits/", "/flashcards/",
    "/timer/", "/subjects/", "/sessions/", "/goals/", "/reports/", "/settings/"];
  const list = (prefix) => pages.map((p) => [`${prefix}${p.replace(/\//g, "-").replace(/-$/, "")}`, p]);
  await shoot({ width: 1440, height: 900 }, 1, list("laptop"));
  await shoot({ width: 390, height: 844 }, 1, list("phone"));
  await browser.close();
  process.exit(0);
}
const showAnswer = async (page) => { await page.getByTestId("review-show").click(); await page.waitForTimeout(400); };
await shoot({ width: 1440, height: 900 }, 1, [
  ["laptop-dashboard", "/dashboard/"],
  ["laptop-calendar", "/calendar/", async (p) => { await p.getByTestId("cal-view-week").click(); await p.waitForTimeout(500); }],
  ["laptop-review", "/flashcards/review/", showAnswer],
  ["laptop-stats", "/flashcards/stats/"],
  ["laptop-timetable", "/timetable/"],
  ["laptop-exams", "/exams/"],
  ["laptop-subject", "/subjects/view/?id=bio"],
  ["laptop-flashcards", "/flashcards/"],
]);
await shoot({ width: 390, height: 844 }, 2, [
  ["phone-today", "/today/"],
  ["phone-review", "/flashcards/review/", showAnswer],
  ["phone-calendar", "/calendar/", async (p) => {
    await p.getByTestId("cal-view-day").click();
    const back = (await p.evaluate(() => new Date().getDay()) + 6) % 7; // go to this week's Monday (busy day)
    for (let i = 0; i < back; i++) await p.getByTestId("cal-prev").click();
    await p.waitForTimeout(500);
  }],
  ["phone-habits", "/habits/"],
  ["phone-timer", "/timer/?subjectId=bio&subjectName=Biology"],
  ["phone-month", "/calendar/", async (p) => { await p.getByTestId("cal-view-month").click(); await p.waitForTimeout(500); }],
]);

// ── Hero: laptop and phone together ──────────────────────────────────────────
const fs = await import("fs");
const img = (n) => `data:image/png;base64,${fs.readFileSync(`${OUT}/${n}.png`).toString("base64")}`;
const hero = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await hero.setContent(`<html><body style="margin:0;width:1600px;height:900px;background:radial-gradient(ellipse at 30% 0%,#2a1650 0%,#131316 60%);display:flex;align-items:center;justify-content:center;font-family:sans-serif">
  <div style="position:relative;width:1440px;height:780px">
    <div style="position:absolute;left:0;top:30px;width:1120px;border-radius:18px;overflow:hidden;border:10px solid #22222c;box-shadow:0 40px 90px rgba(0,0,0,.6)">
      <img src="${img("laptop-dashboard")}" style="display:block;width:100%"></div>
    <div style="position:absolute;right:40px;top:40px;width:330px;border-radius:44px;overflow:hidden;border:12px solid #22222c;box-shadow:0 40px 90px rgba(0,0,0,.7)">
      <img src="${img("phone-review")}" style="display:block;width:100%"></div>
  </div></body></html>`);
await hero.waitForTimeout(300);
await hero.screenshot({ path: `${OUT}/hero.png` });
console.log("saved hero");
await browser.close();
