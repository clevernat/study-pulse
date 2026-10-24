import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { feedForToken, processDueReminders, type Sender } from "./core";
import { adminStore } from "./adminStore";

initializeApp();
const store = adminStore(getFirestore());

/**
 * Private calendar feed: GET /cal/<secret>.ics (Hosting rewrite).
 * Google, Apple and Outlook Calendar re-download it every few hours.
 */
export const calendarFeed = onRequest({ cors: false, memory: "256MiB", maxInstances: 10 }, async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") { res.status(405).send("Method not allowed"); return; }
  const token = (req.path.split("/").pop() ?? "").replace(/\.ics$/, "");
  const ics = await feedForToken(store, token);
  if (!ics) { res.status(404).send("Not found"); return; }
  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Content-Disposition", 'inline; filename="studypulse.ics"');
  res.set("Cache-Control", "private, max-age=900");
  res.status(200).send(ics);
});

const sendPush: Sender = async (tokens, msg) => {
  if (process.env.FUNCTIONS_EMULATOR === "true") { logger.info("Emulator: would send push", { tokens: tokens.length, msg }); return []; }
  const result = await getMessaging().sendEachForMulticast({
    tokens,
    // Data-only message: the service worker shows the notification itself.
    data: { title: msg.title, body: msg.body, url: msg.url, tag: msg.tag },
    webpush: { headers: { Urgency: "high", TTL: "3600" } },
  });
  return result.responses.flatMap((r, i) =>
    !r.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(r.error?.code ?? "") ? [tokens[i]] : []);
};

/** Every 5 minutes: send reminders that are due. */
export const sendReminders = onSchedule({ schedule: "every 5 minutes", timeZone: "UTC", memory: "256MiB" }, async () => {
  const r = await processDueReminders(store, sendPush);
  logger.info("Reminders processed", r);
});
