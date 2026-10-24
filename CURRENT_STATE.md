# StudyPulse: Current State (Phase 1)

Date: 2026-10-23
Folder: `studypulse/` (this folder), branch `feature/study-upgrade`
Written in simple English.

---

## 1. Important: there are two versions of the code

| Version | Where | Last change |
|---|---|---|
| GitHub `main` | github.com/clevernat/study-pulse | Commit `8faedc7`, 2026-05-15 |
| **Your local folder** | `studypulse/` | Files changed 2026-05-19 to 2026-05-21, **never committed, never pushed** |

Your local folder has a lot of extra work that is not on GitHub:

- **New pages:** `Today` (`src/app/today/page.tsx`) and `Tasks` (`src/app/tasks/page.tsx`).
- **New files:** `GoalModal.tsx`, `ReflectionModal.tsx` (a short note after each focus session), `reflectionStore.ts`, `pipTimer.ts` (picture-in-picture floating timer, Chrome only).
- **Changed:** 21 files, about 2,700 lines added. For example: tasks now have a due date, a priority and an estimated time; goals compute their progress from real sessions; goals can be quarterly or yearly; the dashboard has 12 badges; sessions can be edited and deleted; the timer has session types ("Deep Work", "Reading", ...); settings toggles (reduced motion, daily 9 PM reminder) now do something.
- **Rename:** this work started to rename "Subjects" to "Focus Areas", but only in some places (see section 5).

**My suggestion:** keep this local work. It is the newest code, it builds, and it fixes some old bugs. I have not committed it. I will ask you before I commit it (see PLAN.md, "Questions for you").

### iCloud problem (fixed)

Your Desktop folder is synced with iCloud. iCloud had moved many files to the cloud only ("dataless" files): 18 source files, 388 files inside `.git`, and most of `node_modules`. Because of this, `git`, `npm test` and the build froze.

What I did (nothing was deleted):

1. Downloaded all source files and all `.git` files back to the Mac with `brctl download`. Git works again.
2. Moved the old, cloud-only `node_modules`, `.next` and `out` folders to `../_old-icloud-generated/`. You can delete that folder later. These folders are generated and can always be rebuilt.
3. Ran `npm ci` to install fresh packages.

Risk: iCloud can move files to the cloud again if the Mac needs disk space. If git or npm freeze again, this is the reason. A folder outside iCloud (for example `~/Developer`) avoids this.

---

## 2. Test results today (local version, with your uncommitted work)

| Check | Result |
|---|---|
| `npm ci` | OK |
| Jest (`jest --roots src`) | **10 of 10 tests pass** (only `src/lib/streakLogic.test.ts` exists) |
| `npm test` (plain) | **Freezes** in this folder. Jest scans every folder, including cloud-only ones. Fix planned: set `roots: ["<rootDir>/src"]` in `jest.config.js`. |
| `next lint` | 0 errors, 2 warnings (`timer/page.tsx:155`, `TimerSync.tsx:201`, React hook dependencies) |
| `next build` | **OK**. 15 static pages. |
| Firebase emulators (auth + firestore) | Start OK (Java 27, firebase-tools 15.34.0) |
| `npm run seed:local` | OK, test user created |
| Log in on emulator | OK |
| Add a subject | OK |
| Log a session | OK. Dashboard shows streak 1, 25 min, badge "First Session" |
| Open every page (dashboard, today, tasks, subjects, sessions, timer, goals, reports, settings) | All load. **No console errors.** |
| Phone width 375 px | No sideways scrolling. But see bugs below. |
| Pomodoro timer full cycle | Not tested in Phase 1 (needs 25 minutes). Will be tested in Phase 5. |

---

## 3. Features that exist today

### Pages (`src/app`)
| Page | What it does |
|---|---|
| `/` | Landing page (marketing) |
| `/login` | Email + password, Google sign-in |
| `/dashboard` | Streak, weekly minutes, daily average, 7-day bar chart, 90-day heat map, tasks widget, subjects, recent sessions, CSV export, 12 badges (local work) |
| `/today` | (local work) Today's tasks, overdue tasks, goals, today's sessions |
| `/tasks` | (local work) Task planner: due date, priority, estimate, filters (all/today/overdue/done), sort |
| `/subjects` | Create, edit, delete subjects (name, icon, color, category). Live totals from sessions. "Study now" opens the timer. |
| `/sessions` | Session history grouped by day, filters (today/week/month/all). Edit and delete (local work). |
| `/timer` | Pomodoro: focus, short break, long break, presets, cycles, subject, session type (local work), picture-in-picture (local work). Saves a session after each focus period. Synced across devices. |
| `/goals` | Daily/weekly/monthly (+ quarterly/yearly local) goals in hours, progress computed from sessions (local work) |
| `/reports` | Weekly trend, subject split, heat map, focus by weekday, hour of day, insights |
| `/settings` | Timer lengths (synced), reduced motion, notification toggles, JSON export, delete all data |

### Always-on parts (`src/components/layout`)
- `ClientShell`: sidebar, top bar, login redirect, cross-device timer sync, 9 PM reminder (local work).
- `FloatingTimer`: small draggable timer on all pages except `/timer`.
- `TimerSync`: saves focus sessions, plays sounds, shows a browser notification.
- `TopBar`: ambient sounds (rain, ocean, wind, fire, 3 noises), master volume, tasks popover, "Log Session" button.
- `CompletionToast`: after a focus session, asks "mark the task done?".
- `ReflectionModal` (local work): short note after a session.

### Stores (`src/store`)
- `timerStore.ts`: Pomodoro engine (Zustand, saved in localStorage).
- `ambientStore.ts`: sound mixer.
- `promptStore.ts`, `reflectionStore.ts`: small in-memory signals.
- `appStore.ts`: **dead code** (mock data, not used).

---

## 4. Data model (Firestore)

All data lives under `users/{uid}/...`.

| Collection | Fields |
|---|---|
| `subjects/{id}` | uid, name, icon, color, category, totalMinutes (*not updated, see bugs*), sessionCount (*not updated*), createdAt |
| `sessions/{id}` | uid, subjectId, subjectName, subjectColor, durationMinutes, focusScore, pomodoroCount, notes?, sessionType? (local), date `YYYY-MM-DD`, startTime `HH:MM`, endTime `HH:MM`, createdAt (server time) |
| `tasks/{id}` | uid, title, completed, subjectId?, subjectName?, dueDate? (local), priority? low/medium/high (local), estimatedMinutes? (local), createdAt |
| `goals/{id}` | uid, title, type daily/weekly/monthly/quarterly/yearly, targetHours, currentHours (not used any more in local work), subjectId?, subjectName?, deadline, completed, createdAt |
| `timerState/current` | Full timer state for cross-device sync, plus deviceId and sessionOwnerDeviceId (local) |
| `preferences/current` | pomodoroLength, shortBreak, longBreak |

Rules (`firestore.rules`): each of the six collections above has its own rule "only the owner (`request.auth.uid == uid`) can read and write". Any **new** collection is blocked until a rule is added.

There are no Firestore indexes (`firestore.indexes.json` is empty).

---

## 5. Problems found (broken or half-done)

### Bugs
1. **Wrong date after evening (UTC bug).** Several places use `new Date().toISOString().slice(0,10)`, which is the UTC date, not your local date. Seen live: at 11 PM on Oct 23 (MDT), "Log Session" offers **Oct 24**. Places: `LogSessionModal.tsx:23`, `GoalModal.tsx:22,78`, `subjects/page.tsx:298`, `settings/page.tsx:171,176`, `ClientShell.tsx:44` (9 PM reminder key). The project already has the right helper `localDateStr()`.
2. **"Weekly" numbers cover 8 days, not 7** (`dashboard/page.tsx:454`, `timer/page.tsx:186`, `sessions/page.tsx:215`: `>= today - 7` includes 8 dates).
3. **Deleting a subject leaves its tasks behind** with an old subject name (`deleteSubject` deletes sessions and goals, not tasks).
4. **"Delete all data" leaves `preferences/current`** behind.
5. **Notification permission is asked on page load** (`TimerSync.tsx:73`). Browsers (and iPhone) want this only after a user tap. On iPhone this call does nothing.
6. **9 PM reminder only works if the app is open at 9 PM.** There is no push from a server.
7. **CSV export does not escape quotes** in notes (`"` inside a note breaks the file).
8. **`npm test` freezes** in this iCloud folder (see section 2).

### Half-done or confusing
9. **Mixed names for subjects.** The same screen says "Add Focus Area" and "Add Your First Subject". Sidebar, top bar, log modal, landing page say "Focus Areas". Subjects page, routes (`/subjects`), types and data say "subject". Count: "focus area" text in 18 files.
10. **Phone menu is missing pages.** The bottom menu has Home, Subjects, Timer, Sessions, Goals. **Today, Tasks and Reports cannot be reached on a phone.**
11. **Phone header cuts the page title** to "D." on 375 px (too many buttons).
12. `Subject.totalMinutes` and `sessionCount` are saved but never updated. Pages now compute totals from sessions, so these fields are useless.
13. Dead code: `src/store/appStore.ts`, `src/lib/mockData.ts`, `src/components/layout/AuthGuard.tsx`.
14. `README.md` is out of date: wrong folder (`cd study-pulse/studypulse`), lists a `signup` page and `jest.config.ts` that do not exist, old Firestore schema.
15. Emulator config: the seed script uses project id `studypulse-demo`, the app uses `studypulse-tracker-app` from `.env.local`. It still works today, but it is fragile. `npm run emulators` imports from `emulator-data`, which is empty.

### Made-up claims (not backed by real features or data)
16. Landing page: "AI-Powered Study Intelligence", "The AI-powered study tracker", "10,000+ Students", "4.9★ Rating", "10,247 Active Students", 3 testimonials with 5 stars, "Join 10,000+ students".
17. Page title and share card: "StudyPulse — AI Study Tracker", "Join 10,000+ students" (`layout.tsx`), and `public/og.svg` shows "10,000+" and "4.9★".
18. Sidebar tagline "Academic Elite" (not a claim, but sounds like marketing).
    There is **no AI feature** in the app.

### Missing for your goal (one app for study + planning, laptop + phone)
- No flashcards, decks or spaced repetition.
- No exams, no timetable, no homework type, no topics per subject.
- No calendar view, no planned study blocks, no habits, no real reminders.
- No calendar sync (.ics).
- Not installable (no manifest, no service worker), no offline mode, no push.
- Only 1 unit test file. No end-to-end tests. No Playwright.

---

## 6. Technical facts that shape the plan

- `next.config.mjs` uses `output: "export"`: the site is **static files only**. There are no API routes. Anything that must run on a server (a live `.ics` feed URL, push messages when the app is closed) runs on a **free Cloudflare Worker** (`worker/`, account otengabrokwah950@gmail.com, `https://studypulse-feed.studypulse-app.workers.dev`). Cloud Functions would need the paid Blaze plan, so they are not deployed.
- Firebase SDK 12.13 supports offline storage in the browser (`persistentLocalCache`).
- `date-fns` 4 is already installed (useful for the calendar).
