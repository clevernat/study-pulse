"use client";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import app, { db, usingEmulators } from "./config";
import { registerServiceWorker, isIos, isInstalled } from "@/lib/pwa";

export type PushStatus =
  | "push"        // server push works on this device (also when the app is closed)
  | "app-only"    // reminders only while the app is open
  | "denied"      // the user blocked notifications
  | "needs-install" // iPhone/iPad: add to Home Screen first
  | "unsupported";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Short id for a device document (derived from the push token). */
async function deviceId(token: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Asks for notification permission (call from a tap) and, when possible,
 * registers this device for server push. Without a push key (or on the
 * emulators) reminders still work while the app is open.
 */
export async function enableNotifications(uid: string): Promise<PushStatus> {
  if (typeof window === "undefined" || !("Notification" in window)) return isIos() && !isInstalled() ? "needs-install" : "unsupported";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  if (!VAPID_KEY || usingEmulators || !(await isSupported())) return "app-only";
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  try {
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return "app-only";
    await setDoc(doc(db, "users", uid, "devices", await deviceId(token)), {
      fcmToken: token,
      platform: navigator.userAgent.slice(0, 120),
      createdAt: Date.now(),
    });
    return "push";
  } catch (err) {
    console.error("Push registration failed:", err);
    return "app-only";
  }
}

/** Shows a notification now (through the service worker when possible, so it also works on phones). */
export async function showLocalNotification(title: string, body: string, url: string, tag?: string): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg) await reg.showNotification(title, { body, icon: "/icons/icon-192.png", tag, data: { url } });
  else new Notification(title, { body, icon: "/icons/icon-192.png", tag });
}
