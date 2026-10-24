"use client";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "./config";
import { queue } from "./firestore";

/** 64 hex characters (256 random bits): impossible to guess. */
export function newFeedToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Creates the user's secret feed link, or replaces it (the old link stops working). */
export async function createFeedToken(uid: string): Promise<string> {
  const current = await getDoc(doc(db, "users", uid, "calendarFeed", "current")).catch(() => null);
  const old = current?.get("token") as string | undefined;
  const token = newFeedToken();
  const b = writeBatch(db);
  if (old) b.delete(doc(db, "calendarTokens", old));
  b.set(doc(db, "calendarTokens", token), { uid, createdAt: Date.now() });
  b.set(doc(db, "users", uid, "calendarFeed", "current"), { token, createdAt: Date.now() });
  // The server shows times in this time zone.
  b.set(doc(db, "users", uid, "preferences", "current"), { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, { merge: true });
  await queue(b.commit());
  return token;
}

export async function deleteFeedToken(uid: string): Promise<void> {
  const current = await getDoc(doc(db, "users", uid, "calendarFeed", "current")).catch(() => null);
  const old = current?.get("token") as string | undefined;
  const b = writeBatch(db);
  if (old) b.delete(doc(db, "calendarTokens", old));
  b.delete(doc(db, "users", uid, "calendarFeed", "current"));
  await queue(b.commit());
}

export function feedUrls(token: string, origin: string) {
  const https = `${origin}/cal/${token}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=StudyPulse`,
  };
}
