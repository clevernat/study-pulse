# Local Dev Credentials

> These only work when running with Firebase Emulators (`npm run dev:local`).
> They do NOT exist in production.

## Test Account

| Field    | Value                  |
|----------|------------------------|
| Email    | test@studypulse.local  |
| Password | Test1234!              |

## How to use

1. Start local dev + emulators:
   ```
   npm run dev:local
   ```
2. Seed the test account (first time only, or after emulator data is wiped):
   ```
   npm run seed:local
   ```
3. Open http://localhost:3000 and log in with the credentials above.

## Notes

- Firebase requires passwords of 6+ characters, so `1234` cannot be used.
- The emulator data is saved to `./emulator-data/` and reloaded on next start.
- Your production account (`otengabrokwah950@gmail.com`) is completely separate.
