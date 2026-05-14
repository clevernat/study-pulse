# StudyPulse — AI Study Tracker

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-studypulse--tracker--app.web.app-7c3aed?style=for-the-badge&logo=firebase&logoColor=white)](https://studypulse-tracker-app.web.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3-06b6d4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**Track every session. Build unstoppable momentum.**

[Live App](https://studypulse-tracker-app.web.app) · [Report a Bug](https://github.com/clevernat/study-pulse/issues) · [Request a Feature](https://github.com/clevernat/study-pulse/issues)

</div>

---

## Overview

StudyPulse is a full-stack study tracking web app built with Next.js 14 and Firebase. It gives students a single place to run Pomodoro sessions, log study hours, manage subjects and goals, and visualise progress with real-time charts — all synced across every device they own.

Everything is free, no account-gating, and the data never leaves the user's own Firestore database.

---

## Features

### Authentication
- Email / password sign-up and sign-in
- Google OAuth one-click login
- Persistent sessions via Firebase Auth
- Protected routes — unauthenticated users are redirected to `/login`

### Dashboard
- **Daily streak counter** — computed from real session dates using a streak-logic library with full test coverage
- **Weekly study hours bar chart** — last 7 days, computed dynamically from Firestore sessions
- **90-Day velocity heatmap** — fluid grid that fills its card, colour intensity based on hours studied
- **Recent sessions list** — last 5 sessions sorted by date
- **Export logs** — one-click CSV download of all sessions

### Pomodoro Timer
- Configurable focus / short break / long break durations
- Visual progress ring and phase indicator
- Auto-advances through cycles
- Completed focus sessions are automatically saved to Firestore with subject, duration, and timestamp

### Sessions
- Full session history loaded from Firestore
- Filter by Today / This Week / This Month / All Time
- Empty state with call to action when no sessions exist

### Subjects
- Create and manage study subjects
- Total hours per subject tracked automatically from logged sessions
- Data synced to Firestore under the user's document

### Goals
- Create daily and weekly study targets
- Progress tracked against real session data
- Empty state guidance for new users

### Reports
- **Weekly trend line** — ISO-week grouping over the last 8 weeks
- **Subject breakdown donut** — percentage split by subject
- **Study time heatmap** — 7 × 7 grid with quartile intensity, fills the card
- **Focus score bars** — average focus score by day of week
- Period selector: This Week / This Month / Last 3 Months
- All charts show a meaningful empty state when no data exists

### Settings
- Display name and email from Firebase Auth
- Notification preferences
- One-click data export from Settings page
- Account deletion flow

### Landing Page
- Fully responsive (mobile-first)
- Hero with animated badge and CTA buttons
- Feature highlights, testimonials, and FAQ accordion
- Dynamic copyright year

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, static export) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v3 with custom design tokens |
| State | Zustand |
| Backend | Firebase Firestore + Firebase Auth |
| Hosting | Firebase Hosting |
| Fonts | Space Grotesk · Inter · JetBrains Mono |
| Icons | Material Symbols Outlined |
| Testing | Jest + ts-jest |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Firebase project with **Authentication** and **Firestore** enabled

### 1. Clone the repo

```bash
git clone https://github.com/clevernat/study-pulse.git
cd study-pulse/studypulse
npm install
```

### 2. Set up Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a project.
2. Enable **Email/Password** and **Google** sign-in providers under Authentication → Sign-in method.
3. Create a **Firestore** database in production mode.
4. Register a Web app and copy the config values.

### 3. Configure environment variables

Create a `.env.local` file in the `studypulse/` directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

> `.env.local` is listed in `.gitignore` and will never be committed.

### 4. Set Firestore security rules

In the Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Build the static export to `out/` |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Jest test suite |

### Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

---

## Project Structure

```
studypulse/
├── public/
│   ├── favicon.svg          # SVG favicon (pulse line icon)
│   └── og.svg               # Open Graph image (1200 × 630)
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx         # Landing page
│   │   ├── login/
│   │   ├── signup/
│   │   ├── dashboard/
│   │   ├── timer/
│   │   ├── sessions/
│   │   ├── subjects/
│   │   ├── goals/
│   │   ├── reports/
│   │   └── settings/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── ClientShell.tsx   # Auth-aware shell (navbar vs bare)
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   └── ui/              # Reusable UI primitives
│   ├── context/
│   │   └── AuthContext.tsx  # Firebase Auth React context
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── config.ts    # Firebase app initialisation
│   │   │   ├── auth.ts      # Auth helpers
│   │   │   └── firestore.ts # Firestore CRUD helpers
│   │   ├── streakLogic.ts   # computeStreak() — fully tested
│   │   └── mockData.ts      # Demo data (relative dates)
│   ├── store/
│   │   ├── timerStore.ts    # Pomodoro state machine (Zustand)
│   │   └── appStore.ts      # Global app state (Zustand)
│   └── types/               # Shared TypeScript interfaces
├── next.config.mjs
├── tailwind.config.ts
├── jest.config.ts
└── firebase.json
```

---

## Firestore Schema

```
users/{uid}
  ├── profile fields (displayName, email, preferences)
  ├── subjects/{subjectId}
  │     name, color, totalHours, createdAt
  ├── sessions/{sessionId}
  │     subjectId, subjectName, duration (minutes),
  │     date (YYYY-MM-DD), focusScore, notes, createdAt
  └── goals/{goalId}
        type (daily|weekly), targetHours, currentHours,
        startDate, endDate, createdAt
```

---

## Design System

| Token | Value | Usage |
|---|---|---|
| Primary | `#d2bbff` / `#7c3aed` | Accent, CTAs, active nav |
| Secondary | `#40efb7` | Positive stats, streaks |
| Tertiary | `#ffb95f` | Warnings, goals |
| Background | `#131316` | Page background |
| Surface | `#12121a` | Cards |
| Border | `#252535` | Card borders, dividers |
| Font — Display | Space Grotesk 600/700 | Headings, wordmark |
| Font — Body | Inter 400/500/600 | UI text |
| Font — Mono | JetBrains Mono 500/600 | Stats, numbers |

Cards use the `glass-card` utility: `bg-[#12121a] border border-[#252535] rounded-xl`.

---

## Tests

```
PASS  src/lib/streakLogic.test.ts
  computeStreak
    ✓ returns 0 for empty array
    ✓ returns 1 for a single session today
    ✓ returns 1 for a single session yesterday
    ✓ returns correct streak for consecutive days
    ✓ breaks streak on gap
    ✓ handles duplicate dates
    ✓ handles future dates gracefully
    ✓ returns streak when last session is yesterday
    ✓ handles long streaks
    ✓ handles unsorted input

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

Run with:

```bash
npm test
```

---

## License

MIT © Oteng A. Nathaniel
