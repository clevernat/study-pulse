// Small SVG charts for the admin and dashboard pages (no chart library).
import { COLOR_PALETTE, getColor } from "@/lib/colorPalette";
import { addDays } from "@/lib/timetable";
import { formatSmartDuration } from "@/lib/dateUtils";

const KEYS = Object.keys(COLOR_PALETTE);
const TRACK = "#292b30";

/** A steady color per person. */
export function memberColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return getColor(KEYS[h % KEYS.length]).dot;
}

const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) => new Date(date + "T12:00:00").toLocaleDateString("en-US", opts);

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span aria-hidden="true" className="rounded-full flex items-center justify-center font-grotesk font-bold shrink-0 text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Line + soft fill of daily minutes. */
export function Sparkline({ values, color, width = 120, height = 36 }: { values: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(30, ...values);
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  const id = `spark-${color.slice(1)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** 14 bars of daily minutes ending `today`, stacked when there are several people. */
export function DayBars({ series, today, height = 160, testId }: { series: { name: string; color: string; values: number[] }[]; today: string; height?: number; testId?: string }) {
  const totals = Array.from({ length: 14 }, (_, i) => series.reduce((n, s) => n + (s.values[i] ?? 0), 0));
  const max = Math.max(60, ...totals);
  return (
    <div data-testid={testId} className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {totals.map((total, i) => {
          const date = addDays(today, i - 13);
          const tip = `${dayLabel(date, { weekday: "short", month: "short", day: "numeric" })}: ${formatSmartDuration(total)}` +
            (series.length > 1 ? series.filter((s) => s.values[i]).map((s) => `\n${s.name}: ${formatSmartDuration(s.values[i])}`).join("") : "");
          return (
            <div key={date} title={tip} className="flex-1 h-full flex flex-col justify-end group">
              <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden transition-opacity group-hover:opacity-80" style={{ height: `${(total / max) * 100}%`, minHeight: total ? 3 : 0 }}>
                {series.map((s) => s.values[i] ? <div key={s.name} style={{ height: `${(s.values[i] / total) * 100}%`, background: s.color }} /> : null)}
              </div>
              {!total && <div className="w-full h-[3px] rounded-full" style={{ background: TRACK }} />}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 text-[10px] text-on-surface-variant">
        {totals.map((_, i) => {
          const date = addDays(today, i - 13);
          return <span key={date} className={`flex-1 text-center ${i === 13 ? "text-on-surface font-bold" : ""}`}>{dayLabel(date, { weekday: "narrow" })}</span>;
        })}
      </div>
    </div>
  );
}

/** Progress ring with the number in the middle. */
export function Ring({ pct, color, label, value, size = 88 }: { pct: number; color: string; label: string; value: string; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <figure className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth="7" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-jetbrains font-bold text-sm text-on-surface">{value}</span>
      </div>
      <figcaption className="text-xs text-on-surface-variant text-center leading-tight">{label}</figcaption>
    </figure>
  );
}

/** Horizontal bars, e.g. time per subject. */
export function HBars({ rows }: { rows: { label: string; color: string; minutes: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-on-surface">{r.label}</span>
          <span className="h-2 rounded-full overflow-hidden" style={{ background: TRACK }}>
            <span className="block h-full rounded-full" style={{ width: `${(r.minutes / max) * 100}%`, background: r.color }} />
          </span>
          <span className="font-jetbrains text-xs text-on-surface-variant w-14 text-right">{formatSmartDuration(r.minutes)}</span>
        </li>
      ))}
    </ul>
  );
}
