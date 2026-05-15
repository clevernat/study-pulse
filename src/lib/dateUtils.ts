/**
 * Returns the LOCAL calendar date as "YYYY-MM-DD".
 * Never uses toISOString() which gives the UTC date and can be a day off
 * for users whose local time is behind UTC (e.g. US timezones after 6–8 PM).
 */
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
