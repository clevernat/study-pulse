import { Platform } from "react-native";
import type * as NotificationsModule from "expo-notifications";
import type { PlannedReminder } from "@/lib/reminders";

/**
 * expo-notifications, or null when it cannot load on this device (for example a native part
 * missing in Expo Go). The app then runs without notifications instead of crashing.
 */
export const Notifications: typeof NotificationsModule | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as typeof NotificationsModule;
  } catch (err) {
    console.warn("Notifications are off on this device:", err);
    return null;
  }
})();

export const TIMER_ALERT_ID = "timer-alert";
const REMINDER_PREFIX = "r-";
// iOS keeps at most 64 scheduled notifications per app; leave room for the timer alert.
const MAX_SCHEDULED = 60;

/** Asks for permission (once). Returns true when notifications are allowed. */
export async function ensurePermission(): Promise<boolean> {
  if (!Notifications) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Reminders", importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  if (allowed(current)) return true;
  if (!current.canAskAgain) return false;
  return allowed(await Notifications.requestPermissionsAsync());
}

const allowed = (p: NotificationsModule.NotificationPermissionsStatus) =>
  Platform.OS === "ios" ? (p.ios?.status === Notifications?.IosAuthorizationStatus.AUTHORIZED || p.ios?.status === Notifications?.IosAuthorizationStatus.PROVISIONAL) : p.granted;

/** Makes the phone's scheduled reminders match the plan (soonest first, up to the iOS limit). */
export async function scheduleReminders(plan: PlannedReminder[]): Promise<void> {
  if (!Notifications) return;
  const wanted = plan.slice(0, MAX_SCHEDULED);
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(REMINDER_PREFIX));
  const have = new Map(scheduled.map((n) => [n.identifier, n.content.data?.fireAt as number | undefined]));
  const keep = new Set<string>();
  if (wanted.length > 0 && !allowed(await Notifications.getPermissionsAsync())) return;

  for (const r of wanted) {
    const id = REMINDER_PREFIX + r.key;
    keep.add(id);
    if (have.get(id) === r.fireAt) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: r.title, body: r.body, sound: true, data: { fireAt: r.fireAt, url: r.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.fireAt) },
    });
  }
  for (const n of scheduled) if (!keep.has(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
}

/** Website paths used in reminders → phone app routes. */
export function routeForUrl(url: unknown): "/" | "/plan" | "/study" {
  if (typeof url !== "string") return "/";
  if (url.startsWith("/tasks") || url.startsWith("/exams") || url.startsWith("/calendar")) return "/plan";
  if (url.startsWith("/flashcards")) return "/study";
  return "/";
}
