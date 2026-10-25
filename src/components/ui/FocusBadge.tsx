import type { Session } from "@/types";

/** Text color for a 1–5 focus rating (or an average of ratings). */
export function ratingColor(r: number | null | undefined): string {
  if (!r) return "text-on-surface-variant";
  if (r >= 4) return "text-secondary";
  if (r >= 3) return "text-tertiary";
  return "text-error";
}

/** "Focus 4/5" for a rated session, "Not rated" otherwise; notes an early stop ("stopped at 60%"). */
export default function FocusBadge({ session, compact = false }: { session: Pick<Session, "focusRating" | "focusScore" | "sessionType">; compact?: boolean }) {
  const r = session.focusRating;
  const stoppedEarly = session.sessionType !== "Flashcards" && session.focusScore > 0 && session.focusScore < 100;
  return (
    <span data-testid="focus-badge" className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {r ? (
        <span className={`font-jetbrains font-semibold text-sm ${ratingColor(r)}`} title="How focused you were (1–5)">
          {compact ? `${r}/5` : `Focus ${r}/5`}
        </span>
      ) : (
        <span className="text-xs text-on-surface-variant/70">Not rated</span>
      )}
      {stoppedEarly && !compact && <span className="text-[11px] text-on-surface-variant" title="Share of the planned focus time studied">stopped at {session.focusScore}%</span>}
    </span>
  );
}
