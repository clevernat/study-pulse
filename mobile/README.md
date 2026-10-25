# StudyPulse phone app (iOS and Android)

React Native app made with [Expo](https://expo.dev) (SDK 58). It uses the same
Firebase project and data as the website, so the phone and the laptop always
show the same plan, cards and timer.

## What is in it

| Tab | What you can do |
| --- | --- |
| Today | Study time, tasks due, cards due, classes, planned study blocks, exams soon, today's sessions |
| Plan | Tasks (add, edit, finish, delete) and a 2-week agenda (classes, exams, tasks, study blocks) |
| Timer | Pomodoro timer, synced live with the website's timer |
| Study | Flashcard decks and review (same FSRS scheduling as the website) |
| Settings | Timer lengths (all devices), reminders and timer alerts on this phone, sign out |

Subjects, decks, card import, exams, timetable, habits and reports are still
edited on the website ("Open the website" in Settings).

## How the code is shared with the website

The app imports the website's code in `../src` (types, Firestore helpers,
flashcard scheduling, reminders, the timer store) with the `@/` alias. This
app's own code uses `~/`. Three small files in `../src` replace web-only parts
on phones (Metro picks `*.native.ts(x)` first; the website ignores them):

- `src/lib/firebase/config.native.ts`: Firebase with phone storage for sign-in
- `src/context/AuthContext.native.tsx`: email + password sign-in
- `src/lib/sounds.native.ts`: haptics instead of browser sounds

`metro.config.js` makes packages imported from `../src` load from this app's
`node_modules`, so there is one copy of `firebase` and `react`.

## Sign-in

Phones sign in with email + password. A Google account sets a password on the
website: Settings → Phone app sign-in. (A Google button needs a store build.)

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the website's Firebase values
npx expo start
```

Scan the QR code with the **Expo Go** app (App Store / Google Play). The phone
must be on the same Wi-Fi as the computer.

## Test with local data (no real account)

```bash
firebase emulators:start --only auth,firestore --project demo-studypulse   # in the project root
npm run seed:emulator        # demo@studypulse.test / demopass1
npm run start:emulators      # then press i for the iOS Simulator
```

## Checks

```bash
npm run typecheck
npx expo lint
npx expo-doctor
```

## Notifications

Reminders and timer alerts are scheduled on the phone itself (local
notifications), so they work in Expo Go and need no server or paid account.
iOS keeps at most 64 scheduled notifications, so the app schedules the next 60.
