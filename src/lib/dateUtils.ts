/**
 * Returns the LOCAL calendar date as "YYYY-MM-DD".
 * Never uses toISOString() which gives the UTC date and can be a day off
 * for users whose local time is behind UTC (e.g. US timezones after 6–8 PM).
 */
/** Local "YYYY-MM-DD" for the day `n` days before `from` (n = 6 → the first day of a 7-day window ending today). */
export function daysAgoStr(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Smart duration formatter.
 * < 60 min  → "5 min"
 * ≥ 60 min  → "1.5 hrs"
 */
export function formatSmartDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)} hrs`;
}

/**
 * Format a decimal-hours value for display.
 * < 1 h  → "X min"  (e.g. 0.1 → "6 min")
 * ≥ 1 h  → "Xh" or "X.Xh"  (e.g. 1.5 → "1.5h", 2.0 → "2h")
 */
export function formatHours(hours: number): string {
  if (hours <= 0) return "0 min";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const rounded = Math.round(hours * 10) / 10;
  return rounded % 1 === 0 ? `${rounded}h` : `${rounded}h`;
}
