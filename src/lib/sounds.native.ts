// Phone app (Expo) version of sounds.ts: haptics instead of Web Audio.
import * as Haptics from "expo-haptics";

export function playCompletionChime() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function playBreakEndChime() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

// The phone app asks for notification permission itself (mobile/src/lib/notifications.ts).
export async function requestNotificationPermission() {}

// The phone app schedules the "focus complete" / "break over" notification ahead of
// time (mobile/src/lib/app-sync.tsx), so it also arrives when the app is closed.
// Showing another one here would duplicate it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function sendNotification(title: string, body: string) {}
