/**
 * seed-local.mjs — Seed the local Firebase Auth emulator with a test user.
 *
 * NOTE: Firebase Auth requires passwords to be at least 6 characters.
 * The original request used password "1234" (too short) and email "test@gmail.com".
 * We use test@studypulse.local / Test1234! instead to satisfy the constraint
 * and avoid any risk of accidentally hitting a real Gmail account.
 *
 * Usage:
 *   npm run seed:local
 *
 * Prerequisites: Firebase Auth emulator must be running on port 9099.
 *   npm run emulators   (or npm run dev:local)
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from "firebase/auth";

const TEST_EMAIL = "test@studypulse.local";
const TEST_PASSWORD = "Test1234!";

// Minimal config — project ID just needs to match what the emulator expects.
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "studypulse-demo.firebaseapp.com",
  projectId: "studypulse-demo",
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig, "seed-script");

const auth = getAuth(app);

// Always point this script at the local emulator, never production.
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

async function seed() {
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      TEST_EMAIL,
      TEST_PASSWORD
    );
    console.log(`✓ Test user created: ${credential.user.email} (uid: ${credential.user.uid})`);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.log(`ℹ Test user already exists: ${TEST_EMAIL} — nothing to do.`);
    } else {
      console.error("✗ Seed failed:", err.message);
      process.exit(1);
    }
  }
}

seed();
