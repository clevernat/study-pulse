// Local date + time in a named time zone → a real moment (ms since 1970, UTC).
// Uses only Intl, so it works in the browser and in Cloud Functions (Node).

function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-10-24", "09:30", "America/Denver" → UTC milliseconds. */
export function zonedToUtc(date: string, time: string, timeZone: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi || 0);
  // Two passes handle the hour around daylight-saving changes.
  let t = guess - offsetMs(guess, timeZone);
  t = guess - offsetMs(t, timeZone);
  return t;
}

/** UTC ms → "YYYY-MM-DD" in the time zone. */
export function zonedDate(utcMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utcMs));
}
