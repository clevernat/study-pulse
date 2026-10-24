# StudyPulse — Study Planner and Flashcards

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-studypulse--tracker--app.web.app-7c3aed?style=for-the-badge&logo=firebase&logoColor=white)](https://studypulse-tracker-app.web.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

**One app to study and plan, on your laptop and your phone.**

</div>

---

## Features

**Study**
- **Flashcards** — decks per subject; Basic, Basic + reverse and Cloze (`{{c1::answer::hint}}`) cards; spaced repetition with FSRS ([ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)); Again / Hard / Good / Easy with the next interval on each button; keyboard keys; undo; daily limits; stats and a 30-day forecast.
- **Import** — Anki `.apkg` files (old and current formats) and CSV/TSV files.
- **Focus timer** — Pomodoro with breaks, ambient sounds, picture-in-picture, synced across devices. Every focus period (and every flashcard review) is saved as a study session.
- **Subjects, topics and goals** — topics to check off per subject, goals that fill up from real sessions, reports, streaks, badges and a 90-day heat map.

**Plan**
- **Today** — classes, planned study, cards to review, habits, exams soon, tasks due.
- **Calendar** — day, week and month views with classes, exams, tasks, planned study blocks and finished sessions. Click an empty hour to plan study time, then start the timer from the block.
- **Exams** — countdown on the dashboard, room and seat, revision progress, warning when an exam clashes with a class.
- **Timetable** — weekly classes, A/B (up to 4) week rotation, term dates and holidays.
- **Tasks** — tasks, homework and revision with due date and time, priority, and "repeat N days after I finish".
- **Habits** — every day or N days a week, amounts (for example 20 cards), automatic habits, streaks.
- **Reminders** — before tasks, exams, classes and study blocks, for habits, and a daily summary.
- **Calendar sync** — a private link for Google, Apple or Outlook Calendar.

**Everywhere**
- Installable app (PWA) for laptop and phone, works offline, data synced through Firebase.

---

## Install the app on your laptop and phone

StudyPulse is a web app you can install. It then opens in its own window, has its own icon, and works offline.

### Laptop (Windows, Mac, Linux)
- **Chrome or Edge:** open https://studypulse-tracker-app.web.app, sign in, then click the **install icon** at the right end of the address bar (or go to **Settings → Install the app → Install StudyPulse**).
- **Safari on Mac:** open the site, then **File → Add to Dock**.

### iPhone and iPad
1. Open the site in **Safari**.
2. Tap the **Share** button (square with an arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. Open StudyPulse **from the new icon**.
5. In the app: **Settings → Reminders → Turn on reminders** and allow notifications.
   (On iPhone, reminders only work when the app was opened from the Home Screen icon. iOS 16.4 or newer.)

### Android
Open the site in Chrome, then menu **⋮ → Install app**. Turn on reminders in **Settings → Reminders**.

### Offline
After you open the app once, it works without internet. Changes you make offline are saved on the device and sent when you are online again. An "Offline" badge shows in the top bar.

---

## Add the calendar feed (Google, Apple, Outlook)

1. In StudyPulse, open **Settings → Calendar sync**.
2. Click **Create my private calendar link**.
3. Add it to your calendar app:
   - **Google Calendar:** click **Add to Google Calendar**, or in Google Calendar on a computer: **Other calendars → + → From URL**, paste the link, **Add calendar**.
   - **Apple Calendar (Mac, iPhone):** click **Add to Apple Calendar**, or on Mac: **File → New Calendar Subscription**, paste the link. On iPhone: **Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar**.
   - **Outlook:** click **Add to Outlook**, or **Add calendar → Subscribe from web**, paste the link.

What you see: exams, homework and tasks with a due date, planned study blocks and your classes (30 days back, 180 days ahead).
The calendar app checks for changes every few hours (Google can take up to a day). The feed is read-only: changes made in the calendar app do not come back to StudyPulse.
**Keep the link private.** If it leaks, click **Make a new link** — the old one stops working.
No subscription wanted? Use **Download a .ics file instead** for a one-time copy.

---

## Development

### Requirements
- Node.js 20+ and npm
- Firebase CLI (`npm i -g firebase-tools`) and Java (for the emulators)

### Set up
```bash
git clone https://github.com/clevernat/study-pulse.git
cd study-pulse
npm install
npm --prefix functions install
```

Create `.env.local` with your Firebase web app config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
# Web push key: Firebase console → Project settings → Cloud Messaging → Web Push certificates
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```

### Run locally (emulators)
```bash
npm run dev:local     # emulators + next dev on http://localhost:3000
npm run seed:local    # creates the test login (see LOCAL_CREDENTIALS.md)
```

### Tests
| Command | What it runs |
|---|---|
| `npm test` | Unit tests (Jest) |
| `npm run test:rules` | Firestore security rules on the emulator |
| `npm run test:functions` | Cloud Functions logic on the emulator |
| `npm run test:e2e` | Builds the app and runs Playwright on the Hosting/Auth/Firestore/Functions emulators (laptop + phone sizes) |
| `npm run test:all` | All of the above |
| `npm run lint` / `npm run build` | Lint / production build |

Test results and screenshots: `TEST_REPORT.md` and `docs/evidence/`.

### Deploy
The live feed and push reminders use Cloud Functions, which need the Firebase **Blaze** plan.
```bash
npm run build        # uses .env.local (never deploy the output of build:e2e)
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

---

## Architecture

| Part | Technology |
|---|---|
| App | Next.js 14 (App Router, static export), TypeScript, Tailwind CSS, Zustand |
| Data | Firestore with offline cache; everything under `users/{uid}/…` |
| Auth | Firebase Auth (email/password, Google) |
| Server | Cloud Functions: `calendarFeed` (`/cal/<token>.ics`), `sendReminders` (every 5 minutes, FCM web push) |
| Offline / install | Web app manifest + service worker (`public/sw.js`) |
| Flashcards | ts-fsrs (scheduling), sql.js + fflate + fzstd (Anki import, in a Web Worker), DOMPurify (safe card HTML) |
| Tests | Jest, Playwright, @firebase/rules-unit-testing |

### Firestore collections (`users/{uid}/…`)
`subjects`, `sessions`, `tasks`, `goals`, `topics`, `exams`, `classes`, `studyBlocks`, `habits`, `decks`, `notes`, `cards`, `reviewLogs`, `reminders`, `devices`, `preferences/current`, `preferences/timetable`, `timerState/current`, `calendarFeed/current`.
Top level: `calendarTokens/{token}` (owner of a calendar link).
Security rules: each user can only read and write their own data (`firestore.rules`, tested in `tests/rules`).

---

## Credits and license

Scheduling uses [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT). Anki file import uses [sql.js](https://github.com/sql-js/sql.js), [fflate](https://github.com/101arrowz/fflate) and [fzstd](https://github.com/101arrowz/fzstd) (MIT). No code was copied from other apps.

MIT © Oteng A. Nathaniel
