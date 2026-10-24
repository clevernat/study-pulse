// Cloudflare Worker (free plan): the private calendar feed and reminder push.
// Replaces the Cloud Functions in functions/, which need the paid Firebase plan.
import { feedForToken, processDueReminders, TOKEN_RE, type Sender } from "../../functions/src/core";
import { restStore } from "./firestoreRest";
import { accessToken, type ServiceAccount } from "./googleAuth";

interface Env {
  PROJECT_ID: string;
  /** The service account key file (JSON), set with: wrangler secret put SERVICE_ACCOUNT */
  SERVICE_ACCOUNT: string;
}

const SCOPES = ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/firebase.messaging"];
const tokenFor = (env: Env) => () => accessToken(JSON.parse(env.SERVICE_ACCOUNT) as ServiceAccount, SCOPES);

/** Sends through Firebase Cloud Messaging (free). Returns the tokens FCM no longer knows. */
const fcmSender = (env: Env): Sender => async (tokens, msg) => {
  const auth = await tokenFor(env)();
  const results = await Promise.all(tokens.map(async (token) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.PROJECT_ID}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      // Data-only message: the service worker (public/sw.js) shows the notification itself.
      body: JSON.stringify({ message: { token, data: msg, webpush: { headers: { Urgency: "high", TTL: "3600" } } } }),
    });
    if (res.ok) return null;
    const text = await res.text();
    if (res.status === 404 || text.includes("UNREGISTERED")) return token;
    console.error("FCM send failed", res.status, text);
    return null;
  }));
  return results.filter((t): t is string => t !== null);
};

export default {
  /** GET /cal/<secret>.ics — Google, Apple and Outlook Calendar re-download it every few hours. */
  async fetch(req: Request, env: Env): Promise<Response> {
    const m = new URL(req.url).pathname.match(/^\/cal\/([^/]+)\.ics$/);
    if (!m || !TOKEN_RE.test(m[1])) return new Response("Not found", { status: 404 });
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const ics = await feedForToken(restStore(env.PROJECT_ID, tokenFor(env)), m[1]);
    if (!ics) return new Response("Not found", { status: 404 });
    return new Response(req.method === "HEAD" ? null : ics, { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="studypulse.ics"',
      "Cache-Control": "private, max-age=900",
    } });
  },

  /** Every 5 minutes (wrangler.toml): send reminders that are due. */
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(processDueReminders(restStore(env.PROJECT_ID, tokenFor(env)), fcmSender(env))
      .then((r) => console.log("Reminders processed", JSON.stringify(r))));
  },
};
