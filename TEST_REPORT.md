# StudyPulse Upgrade: Test Report (Phase 5)

Date: 2026-10-24. Branch: `feature/study-upgrade`. Written in simple English.

## 1. Summary

| Check | Result | Saved output |
|---|---|---|
| Unit tests (Jest) | **104 passed**, 13 files | `docs/evidence/test-output/unit-tests.txt` |
| Firestore rules tests (emulator) | **37 passed** | `docs/evidence/test-output/rules-tests.txt` |
| Cloud Functions tests (emulator) | **3 passed** | `docs/evidence/test-output/functions-tests.txt` |
| End-to-end tests (Playwright, emulators, laptop 1280×800 + phone 375×812) | **58 passed**, 2 skipped on purpose (one phone-only and one laptop-only test) | `docs/evidence/test-output/e2e-tests.txt` |
| `npm run build` | OK, 25 static pages | `docs/evidence/test-output/build.txt` |
| `npm run lint` | **0 warnings, 0 errors** (before: 2 warnings) | `docs/evidence/test-output/lint.txt` |
| Calendar feed checked with an independent parser (Mozilla ical.js) | OK, 64 events, times correct | `docs/evidence/test-output/ics-feed-parse.txt` |

How the end-to-end tests work: the production build of the app runs on the Firebase Hosting emulator, with the Auth, Firestore and Functions emulators (project `demo-studypulse`, nothing goes to the real cloud). Every test makes a new user and uses the real screens. Screenshots are saved for laptop and phone.

Run everything yourself with:

```bash
npm run test:all
```

## 2. Results per feature

"Done" means: tests pass AND the feature was used in the running app with a screenshot.

| # | Feature | Unit tests | End-to-end test | Screenshots (`docs/evidence/screenshots/`) | Status |
|---|---|---|---|---|---|
| C1 | Your local work (Today, Tasks, badges, reflections, PiP timer) committed | — | `smoke.spec.ts`, `cleanup.spec.ts` (all pages open) | `00-dashboard-*` | Done |
| C2 | One name "Subjects" everywhere | — | `cleanup.spec.ts` (no "Focus Area" on 7 pages) | `02-dashboard-phone` | Done |
| C3 | No made-up numbers, reviews or "AI" claims | — | `cleanup.spec.ts` (landing + login + page title) | `02-landing-*` | Done |
| C4 | Bug fixes: local date (not UTC), 7-day weeks, subject delete, delete all data, CSV quotes, notification permission on tap | `dateUtils.test.ts`, `csv.test.ts` | `cleanup.spec.ts`, `timezone.spec.ts` (23:30 in Denver logs the right day) | — | Done |
| C5 | Phone menu reaches every page | — | `cleanup.spec.ts` (every page via "More"; header not cut; laptop sidebar fits 800 px) | `02-more-sheet-phone` | Done |
| C6 | Test setup (Jest, Playwright, emulators, rules tests) | — | all | — | Done |
| M1 | Topics per subject with checkmarks | `exams.test.ts` (progress) | `planner-exams.spec.ts` | `03-topics-*` | Done |
| M2 | Exams + countdown on dashboard | `exams.test.ts` (days, colours, daylight saving) | `planner-exams.spec.ts` | `04-exams-*`, `04-dashboard-exams-*` | Done |
| M3 | Revision linked to an exam | `exams.test.ts`, `tasks.test.ts` (repeat after done) | `planner-exams.spec.ts` | `04-dashboard-exams-*` | Done |
| M4 | Class timetable (weekly, A/B weeks, term, holidays) | `timetable.test.ts` | `timetable.spec.ts` | `06-timetable-week-a-*` | Done |
| M5 | Exam/class clash warning | `timetable.test.ts` | `timetable.spec.ts` | `06-exam-clash-*` | Done |
| M6 | Homework with due date and time | `tasks.test.ts` | `planner-exams.spec.ts` | `05-homework-*` | Done |
| T1 | Calendar day / week / month | `calendar.test.ts` | `calendar.spec.ts` (also checks blocks line up with the hours) | `07-calendar-day/week/month-*` | Done |
| T2 | Planned study blocks | `calendar.test.ts` | `calendar.spec.ts` | `07-calendar-week-*` | Done |
| T3 | Start timer from a block; session linked | — | `calendar.spec.ts` (25-minute focus, fast clock) | `08-timer-from-block-*` | Done |
| T4 | Habits with streaks (daily, X per week, amounts, automatic) | `habits.test.ts` | `habits.spec.ts` | `09-habits-*` | Done |
| T5 | Reminders | `reminders.test.ts` | `reminders-feed.spec.ts` | `16-reminders-settings-*` | Done **while the app is open**. Push when closed: see section 4 |
| A1 | Decks per subject, limits | `flashcards.test.ts` | `flashcards.spec.ts` | `10-deck-*` | Done |
| A2 | Basic, reverse and cloze cards | `flashcards.test.ts` (cloze) | `flashcards.spec.ts` | `10-deck-*` | Done |
| A3 | Daily queue with FSRS (ts-fsrs) | `flashcards.test.ts` (order, limits, siblings, learn-ahead) | `flashcards.spec.ts` | `11-review-*` | Done |
| A4 | Again / Hard / Good / Easy, intervals, keys, undo | `flashcards.test.ts` (scheduler) | `flashcards.spec.ts` | `11-review-answer-*` | Done |
| A5 | Hide until tomorrow, suspend, leeches | `flashcards.test.ts` | `flashcards.spec.ts` | — | Done |
| A6 | Stats and 30-day forecast | `flashcards.test.ts` (stats) | `flashcards.spec.ts` | `12-flashcard-stats-*` | Done |
| A7 | Import Anki `.apkg` (all 3 versions) and CSV | `importers.test.ts` | `import.spec.ts` (3 Anki versions + CSV + bad file) | `13-import-*` | Done with sample decks. Your real decks: see section 4 |
| A8 | Review time saved as a study session | — | `flashcards.spec.ts` ("Saved 2 answers as 1 min of study", session appears) | `11-review-done-*` | Done |
| S1 | Private `.ics` calendar feed + download | `reminders.test.ts` (.ics), functions `core.test.ts` | `reminders-feed.spec.ts` (link, 200/404, new link) | `17-calendar-link-*` | Feed done. Real calendar app: see section 4 |
| P1 | Installable app (PWA) | — | `pwa.spec.ts` (manifest, icons, Apple icon, theme) | `15-install-card-*` | Done in Chromium. Real phone install: see section 4 |
| P2 | Offline use | — | `pwa.spec.ts` (pages and data offline, offline change syncs later) | `14-offline-*` | Done |
| P3 | Web push (also iPhone from Home Screen) | functions `core.test.ts` (sending logic) | — | — | **Built, not proven end-to-end** (section 4) |
| S2 | Two-way Google Calendar | — | — | — | Not built (later, as agreed) |

I also used the running app by hand in the browser with a demo account: Today showed the class (10:00–11:30, Room 204), both exams with "3 days left" and "10 days left", and the open task.

## 3. Bugs found and fixed during testing

1. "Log Session" offered tomorrow's date in the evening (UTC instead of local date). Fixed in 7 places.
2. "This week" numbers counted 8 days.
3. Term settings form lost what you typed when data arrived from the server.
4. Calendar hour labels drifted up, so a 14:00 block looked like 15:00.
5. Forms waited for the server, so they would hang offline. Now they wait at most 1.5 seconds.
6. The flashcard form erased text typed right after pressing "Add card".
7. The reminder sync deleted the "test reminder".
8. A new user's time zone was not saved, so the calendar feed used UTC times.
9. New preference fields could have reset timer lengths (guarded).
10. Phone: timetable buttons wrapped, empty days took space; long names overlapped in Settings.
11. Laptop sidebar did not fit an 800 px high screen.
12. Removed the "Edit Profile" button in Settings: it did nothing.

## 4. Not finished or not proven (with reasons)

| Item | Why | What is needed |
|---|---|---|
| **Push reminders when the app is closed** (laptop and iPhone) | Needs the Blaze plan, a push key (VAPID) and deployed Cloud Functions. You will create the `studypulse-staging` project and send the key. The sending logic is tested on the emulator with a fake sender; the in-app reminders are tested in the browser. | Your staging project + VAPID key. Then I deploy there and test on your laptop and iPhone. |
| **Subscribing a real calendar app** | I asked to control macOS Calendar and the iOS Simulator; both requests were not granted, so I did not touch them. Instead: the feed is tested end-to-end through the Hosting + Functions emulators and parsed by Mozilla's ical.js (64 events, correct times, also after the daylight-saving change). Google and Outlook can only subscribe to a public HTTPS address. | Staging deploy, then subscribe Google Calendar (and Apple/Outlook) to the link. |
| **Install on your real iPhone / laptop** | Needs a public HTTPS address and your device. Manifest, icons, service worker and offline mode are tested in Chromium. | After staging deploy: follow the README steps; it takes 1 minute. |
| **Your real Anki decks** | Not received yet. I tested with sample files of all 3 Anki formats that I made myself (`scripts/make-test-apkg.py`). | Put 1–2 exported decks in `test-fixtures/` (not committed) and I will import them. |
| Images and sounds in Anki decks | Left out, as agreed (shown as "[image]" / "[audio]"). | Later: Firebase Storage. |
| Two-way Google Calendar | Later project, as agreed. | — |
| Focus timer in real time | The 25-minute timer test uses a fast-forward clock, not 25 real minutes. | — |

## 5. Things to know (limits)

- **Reminders are planned 14 days ahead** each time the app is open. If you do not open StudyPulse for 14 days, later reminders are not planned yet.
- The daily summary text is made when the app plans it; it is refreshed every time you open the app.
- The calendar feed covers 30 days back and 180 days ahead. Calendar apps refresh it every few hours (Google can take up to a day).
- Classes in the feed are listed one by one (not as repeating rules), so A/B weeks and holidays are exact.
- Flashcards read only what a screen needs (free-plan friendly, 50,000 reads/day): cards due today, a few new cards per deck (4× the daily new limit), today's answers, one small summary per study day, and count queries for totals (1 read per 1,000 cards). The deck page shows the newest 300 notes. Example: a 10,000-card deck with 200 reviews due costs a few hundred reads per app open, not 10,000.
- The calendar link is secret: anyone with the link can see those calendar items. Use "Make a new link" if it leaks.
- Your project folder is in iCloud. If git or npm freeze again, iCloud has moved files to the cloud (see CURRENT_STATE.md).

## 5b. Free plan decision (2026-10-24)

You chose to keep the project on the free Spark plan and add Cloudflare later. So:
- The live calendar link is hidden in the app (turn it on with `NEXT_PUBLIC_CALENDAR_FEED=1` when a server exists). The "Download calendar file (.ics)" button works now.
- Reminders show while the app is open. Push when the app is closed waits for the server.
- Already deployed to `studypulse-tracker-app`: Firestore rules and the reminders index (both free), and the website on a preview link. The live site is unchanged.

Extra checks after this decision: a new end-to-end test proves the old features still work (log session, sessions, dashboard and badges, goals, reports, ambient sounds, tasks popover, CSV/JSON export, Pomodoro + floating timer + reflection). It found and I fixed: a new goal showed twice; goal minutes were rounded (45 min showed as 48); new deck/exam/class forms did nothing if they opened before subjects loaded.

## 6. Before deploying to production (needs your yes)

1. Switch the Firebase project to Blaze.
2. Add `NEXT_PUBLIC_FIREBASE_VAPID_KEY=...` to `.env.local`.
3. `npm run build` (never deploy the output of `npm run build:e2e`: it points to the emulators).
4. `firebase deploy --only firestore:rules,firestore:indexes,functions,hosting`.

## 7. Licenses and credits

No code was copied from Anki, AnkiDroid, TickTick, MyStudyLife or other projects. Open-source packages used (as dependencies): ts-fsrs (MIT), sql.js (MIT), fflate (MIT), fzstd (MIT), DOMPurify (Apache-2.0 / MPL-2.0), Playwright (Apache-2.0), @firebase/rules-unit-testing (Apache-2.0), esbuild (MIT), firebase-functions and firebase-admin (MIT / Apache-2.0). Ideas came from public documentation and help pages only.
