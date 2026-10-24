import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studypulse-demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studypulse-demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studypulse-demo.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef",
};

const isFirstInit = getApps().length === 0;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Offline support: keep a copy of the user's data in IndexedDB so pages work
// without a network and writes are queued until the connection comes back.
// Shared across tabs. Only in the browser (static export pre-render runs in Node).
function makeDb(): Firestore {
  if (!isFirstInit || typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      // Optional fields can be left undefined in app code; Firestore skips them.
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}
export const db = makeDb();

// Local emulators: always in `next dev`, and in a production build when
// NEXT_PUBLIC_USE_EMULATORS=1 (used to test the PWA build offline).
export const usingEmulators =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

// Check auth.emulatorConfig (set by the SDK itself) to avoid double-connecting on hot reload.
if (
  typeof window !== "undefined" &&
  usingEmulators &&
  !(auth as unknown as { emulatorConfig: unknown }).emulatorConfig
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export default app;
