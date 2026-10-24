# StudyPulse Upgrade Plan (Phase 3)

Date: 2026-10-23. Status: **waiting for your approval**. No feature code is written yet.
Read `CURRENT_STATE.md` first. It explains your uncommitted local work and the iCloud problem.

Goal: one app for studying (flashcards, timer) and planning (calendar, exams, timetable, homework, habits, reminders), on laptop and phone.

---

## 1. Research summary

Research notes with a source link for every fact are in the session scratchpad (`research_anki.md`, `research_planners.md`). Short version:

**Anki (AGPL, AnkiDroid GPL): behavior only, no code copied.**
- A *note* holds fields. A note makes one or more *cards*. Cloze text `{{c1::answer::hint}}` makes one card per number.
- Card states: new, learning, review, relearning. Learning steps default `1m 10m`, relearning `10m`.
- 4 rating buttons. Each button shows its next interval before you press it.
- Daily limits per deck: default 20 new cards and 200 reviews.
- Bury (hide until tomorrow), suspend (hide until you undo it), leech after 8 lapses.
- Statistics: today, future due (forecast), calendar heat map, true retention, card counts.
- `.apkg` = a zip with an SQLite database. Three versions exist. The newest (default since Anki 2.1.50) is compressed with zstd.

**ts-fsrs 5.4.2 (MIT):** the scheduler we will use. Its defaults match Anki's (retention 0.9, steps `1m 10m`, max interval 36500 days). It can preview all 4 buttons (`repeat`), undo (`rollback`) and rebuild from history (`reschedule`). Firestore cannot store `undefined`, so we save dates as numbers (milliseconds).

**TickTick (public pages only, REA `inspect_web_page` + help pages):** day/week/month/agenda calendar, time blocks, tasks with priority and repeat, habits with goals and "X times per week", reminders with snooze and "start focus", focus timer linked to tasks, exam countdowns, calendar export by URL.

**MyStudyLife (public pages only, REA `inspect_web_page` + `capture_web_screenshot` + keyword search of the public app file):** subjects own everything; classes with weekly or A/B-week rotation; terms and holidays (no classes on holidays); task types (homework, revision, reminder); revision linked to an exam; exams with room, seat, countdown and score; dashboard with next classes, due tasks and exams; clash warning when an exam overlaps a class; daily task digest.

**REA limits:** both real web apps need a login, so only logged-out pages were studied. `analyze_web_bundle` timed out on the big app bundles; a keyword search of the public MyStudyLife file was used instead (no code copied or run).

**Open-source projects studied (all MIT):**
- `ishiko732/ts-fsrs-demo` (Next.js): review screen with keyboard keys and undo.
- `kirill-markin/flashcards-open-source-app`: a clear queue order (failed cards first, then due cards oldest first, then new cards) and "card is the truth, review log is append-only".
- `ImGajeed76/ankipack`: how to read all `.apkg` versions in a browser.
- I will **learn from these, not copy code**. If I do copy any lines, I will credit the project in `CREDITS.md`.

**Clean-room rules for the build:** our own code, our own UI text, our own design (the current StudyPulse look). No names, logos or text from Anki, TickTick or MyStudyLife. The rating words Again / Hard / Good / Easy are the standard FSRS rating names (used by ts-fsrs) and you asked for them.

---

## 2. Feature table

"Exists?" means in StudyPulse today (your local version).

| # | Feature | From | Exists? | What to build |
|---|---|---|---|---|
| **Clean-up and base** |||||
| C1 | Bring in your uncommitted local work | — | partly (not committed) | Commit it as the first commit on the branch (needs your OK, see Q1) |
| C2 | One name "Subjects" everywhere | — | partly | Change all "Focus Area" text back to "Subjects" (18 files) |
| C3 | Remove made-up stats, reviews and "AI" claims | — | no | Remove "10,000+", "4.9★", "10,247", testimonials, "AI-powered", "AI Study Tracker" from landing page, page title and share image. Show real features instead. |
| C4 | Fix known bugs | — | — | UTC date bug (7 places), 8-day "week", subject delete leaves tasks, "delete all" misses preferences, notification asked on load, CSV quotes |
| C5 | Phone menu reaches every page | — | partly | Bottom bar: Home, Calendar, Timer, Review, More. "More" opens all other pages. Shorter phone header. |
| C6 | Tests that run here | — | partly | Jest `roots: src`; add Playwright + Firebase emulator setup; Firestore rules tests |
| **MyStudyLife-style** |||||
| M1 | Topics inside each subject with checkmarks | MyStudyLife idea | no | Topic list per subject, check off, progress % per subject |
| M2 | Exams with countdown on dashboard | MyStudyLife | no | Exams page (subject, date, time, length, room, seat, notes, score later). Dashboard card: next exams with "N days left" in green/amber/red. |
| M3 | Revision linked to an exam | MyStudyLife | no | Link topics and tasks to an exam. Exam shows "revision progress %". |
| M4 | Class timetable | MyStudyLife | no | Weekly classes (subject, day, start, end, room, teacher). Optional A/B weeks (1–4 week cycle). Term start/end and holidays (no classes). |
| M5 | Exam/class clash warning | MyStudyLife | no | Warn when an exam overlaps a class |
| M6 | Homework with due dates | MyStudyLife | partly (tasks have due date) | Task kind: task / homework / revision, optional due time |
| **TickTick-style** |||||
| T1 | Calendar: day / week / month | TickTick | no | One calendar page with tasks, homework, exams, classes, planned study blocks and finished sessions. Color by subject. |
| T2 | Planned study blocks | TickTick | no | Click an empty time slot to plan a block (subject, task or deck, start, end) |
| T3 | Start timer from a block | TickTick | partly (start from task/subject exists) | "Start" on a block opens the timer with its subject; the saved session is linked to the block; block shows planned vs done minutes |
| T4 | Habits with streaks | TickTick | partly (study streak only) | Habits: daily or X times per week, amount goal (for example 20 cards), check-in, current and best streak, archive |
| T5 | Reminders | TickTick + MyStudyLife | partly (9 PM reminder while app is open) | Reminder time on tasks, homework, exams, study blocks, classes, habits. Daily summary at a time you choose. "N cards due" reminder. Actions: open, mark done, snooze 10 min. |
| **Anki-style** |||||
| A1 | Decks per subject | Anki | no | Decks (each linked to a subject), new/review limits per deck |
| A2 | Cards: basic + cloze | Anki | no | Add/edit notes: Basic (front/back), Basic + reverse, Cloze `{{c1::text::hint}}`. One cloze note makes one card per number. |
| A3 | Daily review queue with FSRS | Anki + ts-fsrs | no | Queue: learning cards due now, then reviews (oldest due first), then new cards. Respect daily limits. |
| A4 | Again / Hard / Good / Easy | Anki | no | Show answer, 4 buttons with next interval, keys 1–4 and Space, undo last answer |
| A5 | Bury / suspend / leech | Anki | no | Bury until tomorrow, suspend, auto-suspend after 8 lapses (setting) |
| A6 | Review stats and forecast | Anki | no | Today (cards, time, % correct), 30-day forecast, review heat map, true retention, card counts |
| A7 | Import CSV and Anki `.apkg` | Anki | no | CSV (front, back, tags). `.apkg` all 3 versions, in the browser. Cards come in as new cards. Images/audio: see Q7. |
| A8 | Link review to study timer | — | no | Review time is saved as a study session ("Flashcards" type), so it counts in streaks, goals and reports. A planned block can be a review block. |
| **Calendar sync** |||||
| S1 | Private `.ics` feed URL | TickTick | no | Secret link per user. Google, Apple and Outlook can subscribe. Shows exams, homework/tasks with due dates, classes (repeating), study blocks. Button to make a new link (old one stops working). Also "Download .ics file". |
| S2 | Two-way Google Calendar | — | no | **Later, not in this build** (see Q6) |
| **Laptop + phone** |||||
| P1 | Installable PWA | — | no | Manifest, app icons (also Apple), standalone mode, "Install app" help in Settings (Chrome button; iPhone: Share → Add to Home Screen) |
| P2 | Offline use | MyStudyLife | no | Service worker keeps pages; Firestore offline storage keeps data; changes sync when back online; "Offline" badge |
| P3 | Web push reminders (iPhone after Add to Home Screen) | — | no | Firebase Cloud Messaging + a scheduled Cloud Function that sends due reminders. Permission is asked only after you tap "Turn on reminders". |

**Small extras I recommend (from research), cheap to add:**
- E1 Daily summary push (tasks due + cards due) at your chosen time. (Part of T5.)
- E2 Exam clash warning. (M5 above.)
- E3 Undo last flashcard answer. (Part of A4.)
- E4 Habit can auto-check from app data: "study 60 min" or "review 20 cards" checks itself.
- E5 Revision task can repeat "N days after I finish it".

**Not planned** (say if you want them): Eisenhower matrix, drag-to-resize blocks, day-rotation timetables (Day 1..N), exam grades/averages, location reminders, AI features.

---

## 3. Data model changes (Firestore)

All new data stays under `users/{uid}/...`, like today. Dates without time are `YYYY-MM-DD` strings (local date). Exact moments are numbers in milliseconds (good for queries and for ts-fsrs).

| Collection | Fields |
|---|---|
| `topics/{id}` | subjectId, title, done, order, examId?, createdAt |
| `exams/{id}` | subjectId, title, date, startTime?, durationMinutes?, room?, seat?, notes?, reminderMinutesBefore?, createdAt |
| `classes/{id}` | subjectId, room?, teacher?, slots: [{ weekday 0–6, start "HH:MM", end "HH:MM", week? 1–4 }], reminderMinutesBefore?, createdAt |
| `preferences/timetable` | termStart, termEnd, rotationWeeks (1–4), rotationStartDate, holidays: [{ name, start, end }] |
| `tasks/{id}` (existing) | **add:** kind "task" / "homework" / "revision", dueTime?, examId?, reminderMinutesBefore?, repeatAfterDays? |
| `studyBlocks/{id}` | title, subjectId?, taskId?, deckId?, date, start, end, done, sessionIds[], reminderMinutesBefore?, createdAt |
| `sessions/{id}` (existing) | **add:** blockId?, deckId?, reviewCount? |
| `habits/{id}` | title, icon, color, schedule { type "daily" } or { type "weekly", timesPerWeek }, target, unit?, autoSource? ("studyMinutes" / "cardsReviewed"), reminderTime?, archived, log { "YYYY-MM-DD": number }, createdAt |
| `decks/{id}` | name, subjectId, newPerDay (20), reviewsPerDay (200), retention (0.9), buryNewSiblings (true), createdAt |
| `notes/{id}` | deckId, subjectId, type "basic" / "basicReverse" / "cloze", fields { front, back } or { text, extra }, tags[], source? ("csv" / "apkg"), createdAt |
| `cards/{id}` | noteId, deckId, ord (card number), due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state 0–3, last_review (number or null), suspended, buriedUntil ("YYYY-MM-DD" or null), createdAt |
| `reviewLogs/{id}` | cardId, deckId, rating 1–4, state, due, stability, difficulty, scheduled_days, review (ms), durationMs, sessionId? (append only) |
| `reminders/{id}` | fireAt (ms), title, body, url, itemType, itemId, sent (false/true) |
| `devices/{id}` | fcmToken, platform, createdAt (one per phone/browser that allows push) |
| `preferences/current` (existing) | **add:** timeZone, dailySummaryTime?, reminders on/off |
| `calendarFeed/current` | token, createdAt |
| **Top level** `calendarTokens/{token}` | uid, createdAt (lets the server find the owner of a feed link) |

Indexes (`firestore.indexes.json`): cards (deckId + due), cards (deckId + state + createdAt), reviewLogs (deckId + review), collection group reminders (sent + fireAt).

**`firestore.rules`** (each user can only read and write their own data):

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /calendarTokens/{token} {
  allow read, delete: if request.auth != null && resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                && request.resource.data.uid == request.auth.uid
                && request.resource.data.keys().hasOnly(['uid', 'createdAt']);
  allow update: if false;
}
// Everything else: no access (default deny).
```

The one wildcard rule replaces six copies of the same rule and covers every new collection. Rules will get their own tests (user A cannot read or write user B's data, not logged in = no access, feed tokens cannot be listed).

---

## 4. Architecture decisions

- **Keep static export.** All pages stay static. New pages use query parameters (for example `/flashcards/review?deck=ID`), because static export cannot make pages for unknown IDs.
- **Server parts use Firebase Cloud Functions** (new `functions/` folder, TypeScript):
  1. `calendarFeed`: answers `https://<site>/cal/<token>.ics` (Hosting rewrite). Reads your data with the Admin SDK and builds the `.ics` text. Repeating classes use `RRULE` with holidays as `EXDATE`.
  2. `sendReminders`: runs every 5 minutes, sends due reminders with Firebase Cloud Messaging, marks them sent. Also sends the daily summary.
  These need the Blaze plan (see Q2).
- **Offline:** Firestore `persistentLocalCache` + multi-tab manager; a small hand-written service worker (`public/sw.js`): pages network-first with cache fallback, `/_next/static` cache-first. No extra PWA library.
- **New packages:** `ts-fsrs` (MIT), `sql.js` (MIT, loaded only on the import page), `fflate` (MIT), `fzstd` (MIT), `dompurify` (Apache-2.0, to clean HTML from imported decks; this is a security need), dev: `@playwright/test` (Apache-2.0), `@firebase/rules-unit-testing` (Apache-2.0). Functions: `firebase-functions`, `firebase-admin` (Apache-2.0/MIT). The `.ics` text is small, so I write it myself (no `ics` package).
- **`.apkg` reader without protobuf:** read note fields from the `notes` table and note-type/deck **names** from plain columns. Cloze is detected by `{{cN::` in the text; otherwise field 1 = front, field 2 = back. Imported cards start as new cards (no Anki history). Read in a Web Worker so the page does not freeze. Big decks are written in batches of 500.
- **Navigation:** sidebar groups: *Plan* (Today, Calendar, Tasks, Exams, Timetable, Habits) and *Study* (Timer, Flashcards, Subjects, Sessions, Goals, Reports), then Settings. Phone: Home, Calendar, Timer, Review, More.
- **Look:** reuse `glass-card`, colors from `getColor()`, `ConfirmModal`, fonts and tokens. Every new interactive element gets a `data-testid`.

---

## 5. Build order (small steps; each one builds, passes lint and tests, and gets its own commit)

| Step | Content | Proof (tests + screenshots) |
|---|---|---|
| 0 | C1 commit local work (after your OK), C6 test setup: Jest roots, Playwright + emulators (`firebase emulators:exec`), seed user per run | Existing 10 tests + 1 smoke e2e (login, dashboard) |
| 1 | Rules: wildcard rule + rules tests. Firestore offline cache. | Rules unit tests |
| 2 | C2 "Subjects" everywhere, C3 landing clean-up, C4 bug fixes, C5 phone menu | Unit tests for date helpers; e2e: phone menu reaches all pages; screenshots 375 px + laptop |
| 3 | M1 topics per subject | Unit: progress %; e2e: add topic, check it, see % |
| 4 | M2 exams + dashboard countdown | Unit: days-left and color; e2e: add exam, see countdown |
| 5 | M6 homework/revision + M3 link to exam | e2e: homework due tomorrow shows on Today; exam shows revision % |
| 6 | M4 timetable (weekly, A/B weeks, term, holidays) + M5 clash warning | Unit: class occurrences (rotation, holidays), clash check; e2e: add class, see it on Today |
| 7 | T1 calendar day/week/month | Unit: date-range expansion; e2e: switch views, items show |
| 8 | T2 + T3 study blocks, start timer from block | e2e: plan block, start, finish (short timer in test), session linked |
| 9 | T4 habits + streaks (+E4 auto-check) | Unit: daily + weekly streaks; e2e: check in, streak shows |
| 10 | A1 + A2 decks, notes, basic + cloze | Unit: cloze parser (numbers, hints, card count); e2e: make deck, add basic + cloze |
| 11 | A3 + A4 + A5 review with FSRS, limits, bury/suspend, undo | Unit: queue order, limits, FSRS state change, date saving; e2e: review a deck with keys 1–4 |
| 12 | A8 review time saved as session | e2e: after review, a "Flashcards" session appears, streak updates |
| 13 | A6 stats + forecast | Unit: forecast, retention; e2e: stats page shows numbers after reviews |
| 14 | A7 import CSV + `.apkg` | Unit: CSV parser, `.apkg` reader on real files (see Q5); e2e: import file, cards appear |
| 15 | P1 + P2 PWA install + offline | e2e: manifest valid, service worker active, page opens offline, change made offline syncs later; screenshot of install |
| 16 | T5 reminders in the app + P3 push (Cloud Function, FCM) | Unit: reminder times; functions test on emulator; real push test (see Q2/Q3) |
| 17 | S1 `.ics` feed (Cloud Function) + download button | Unit: `.ics` text (escaping, line folding, RRULE, EXDATE); e2e: get feed from emulator; subscribe macOS Calendar and Google Calendar (see Q3) |
| 18 | README section (install on laptop and phone, add the calendar feed), TEST_REPORT.md, push branch, open pull request | Full suite, `npm run build`, `npm run lint` |

**Phase 5 checks for every feature:** run its tests and save the output in `docs/evidence/`; use it in the running app on the emulators and save a screenshot; check 375 px and laptop width. Plus PWA install, offline and reminders, and a real calendar subscription. Everything goes into `TEST_REPORT.md`, including anything that could not be proven, with the reason.

**What I can prove alone, and what needs you:**
- Alone: everything on the emulators, laptop browser, phone-size browser, **iOS Simulator** (Add to Home Screen, offline), and **macOS Calendar** subscribed to the feed from the local functions emulator.
- Needs a public HTTPS address (Q3): Google Calendar and Outlook subscriptions (their servers must reach the URL), and push on a real iPhone.
- Needs your hands: installing on your real iPhone. I will give short steps.

I will **not** merge the pull request and **not** deploy to production without your yes.

---

## 6. Questions for you (please answer before I start)

1. **Your local uncommitted work** (Today, Tasks, badges, reflections, picture-in-picture timer, ...): may I commit it as the first commit on `feature/study-upgrade`? (I recommend yes.)
2. **Blaze plan:** the live `.ics` feed and push reminders when the app is closed need Cloud Functions, which need the Blaze (pay as you go) plan. For one user the cost is almost always $0, but a card must be on file. Yes? If no: I build a **download .ics** button (not live) and reminders that work **only while the app is open**.
3. **Public test address:** to prove Google/Outlook subscription and iPhone push without touching your live site, I suggest you create a second Firebase project, for example `studypulse-staging` (Blaze, Auth + Firestore on), and give me its web config. I would deploy only there. Other option: you allow deploying the new functions (not the website) to the production project. Which one?
4. **Push key:** in that Firebase project, Project settings → Cloud Messaging → Web Push certificates → "Generate key pair", then send me the public key. (Or tell me to open the console in the browser for you; you log in yourself.)
5. **Test decks:** please export 1 or 2 of your Anki decks twice: once normal, once with "Support older Anki versions" checked, and put the files in `studypulse/test-fixtures/` (I will not commit your personal decks; I will make small test decks for the repo).
6. **Two-way Google Calendar:** OK to leave this for a later project? It needs a Google OAuth app with Google's review for calendar access, and a server that stores your Google tokens. The `.ics` feed covers reading StudyPulse items in Google Calendar now.
7. **Images and audio in imported Anki decks:** OK to skip them in this build (the card shows "[image]")? Storing them needs Firebase Storage.
8. **Landing page:** OK to remove the testimonials and the stats row completely and show a real feature list instead?
9. **Folder:** this folder is in iCloud, which froze git and npm today. I will keep working here as you asked. If it freezes again, may I move the project to a folder outside iCloud?

Also, for your information: while studying TickTick, the research helper first tried to use the Chrome browser on port 9333, which is **your own logged-in Chrome**. It read the list of your open tab titles once by mistake, took no action, then switched to its own empty browser and deleted that browser's profile at the end.
