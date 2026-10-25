// Phone app (Expo) version of config.ts. Metro picks this file on iOS/Android;
// the website never loads it. Same Firebase project and data as the website.
import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-expect-error getReactNativePersistence only exists in the React Native build of firebase/auth
import { initializeAuth, getAuth, connectAuthEmulator, getReactNativePersistence, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// `npm run start:emulators` sets EXPO_PUBLIC_EMULATORS=1 (local test data, never the real project).
// It must not appear in any .env file: in development, .env values win over the shell.
export const usingEmulators = process.env.EXPO_PUBLIC_EMULATORS === "1";

const DEMO = {
  apiKey: "demo-api-key",
  authDomain: "demo-studypulse.firebaseapp.com",
  projectId: "demo-studypulse",
  storageBucket: "demo-studypulse.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};

export const firebaseConfig = usingEmulators ? DEMO : {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || DEMO.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || DEMO.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || DEMO.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || DEMO.storageBucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEMO.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || DEMO.appId,
};

const isFirstInit = getApps().length === 0;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

// Keeps the user signed in after the app is closed.
export const auth: Auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

// No IndexedDB on phones, so Firestore keeps its cache in memory. Writes made
// offline are queued while the app is open.
export const db: Firestore = isFirstInit
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : getFirestore(app);

if (isFirstInit && usingEmulators) {
  // The Android emulator reaches the computer at 10.0.2.2; the iOS Simulator at localhost.
  const host = Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

export default app;
