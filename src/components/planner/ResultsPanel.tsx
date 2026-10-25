"use client";
import { useState } from "react";
import { useCollection } from "@/lib/firebase/useCollection";
import { addItem, deleteItem } from "@/lib/firebase/firestore";
import { resultsWithEffort, effortCorrelation, effortVerdict, RESULT_WINDOW_DAYS } from "@/lib/insights";
import { formatSmartDuration, localDateStr } from "@/lib/dateUtils";
import { inputCls, secondaryBtnCls } from "@/components/ui/Field";
import type { Session, TestResult } from "@/types";

/** Practice test / quiz scores of one subject, next to the study time before each one. */
export default function ResultsPanel({ uid, subjectId, sessions, barColor }: { uid: string; subjectId: string; sessions: Session[]; barColor: string }) {
  const { items: results } = useCollection<TestResult>("results");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(localDateStr());
  const [score, setScore] = useState("");
  const [max, setMax] = useState("100");
  const [error, setError] = useState("");

  const points = resultsWithEffort(results, sessions, subjectId);
  const verdict = effortVerdict(effortCorrelation(points), points.length);
  const maxMinutes = Math.max(60, ...points.map((p) => p.minutesBefore));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const sc = parseFloat(score), mx = parseFloat(max);
    if (isNaN(sc) || isNaN(mx) || mx <= 0 || sc < 0 || sc > mx) { setError("Enter a score between 0 and the maximum."); return; }
    if (!date) { setError("Pick the date of the test."); return; }
    setError("");
    await addItem<TestResult>(uid, "results", { subjectId, title: title.trim() || "Practice test", date, score: sc, maxScore: mx, createdAt: Date.now() });
    setTitle(""); setScore("");
  }

  return (
    <div className="glass-card p-5 flex flex-col gap-4" data-testid="results-panel">
      <div>
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Results</h2>
        <p className="text-xs text-on-surface-variant">Practice tests and quizzes, next to the time you studied this subject in the {RESULT_WINDOW_DAYS} days before each one.</p>
      </div>

      <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <span className="text-xs text-on-surface-variant font-bold">Test</span>
          <input data-testid="result-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quiz 3" maxLength={80} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant font-bold">Date</span>
          <input data-testid="result-date" className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: "dark" }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant font-bold">Score</span>
          <input data-testid="result-score" className={`${inputCls} w-20`} type="number" step="any" min="0" value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant font-bold">Out of</span>
          <input data-testid="result-max" className={`${inputCls} w-20`} type="number" step="any" min="1" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <button data-testid="result-add" type="submit" className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">add</span>Add</button>
      </form>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      {points.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No results yet. Add your practice-test or quiz scores to see if more study time brings better results.</p>
      ) : (
        <>
          <p data-testid="results-verdict" className="text-sm text-on-surface">{verdict}</p>
          <ul className="flex flex-col divide-y divide-outline-variant/40">
            {[...points].reverse().map(({ result: r, pct, minutesBefore }) => (
              <li key={r.id} data-testid="result-item" className="py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-on-surface flex-1 min-w-0 truncate">{r.title}</span>
                  <span className="text-xs text-on-surface-variant font-jetbrains">{r.date}</span>
                  <span className="font-jetbrains font-semibold text-on-surface w-28 text-right">{r.score}/{r.maxScore} · {pct}%</span>
                  <button onClick={() => deleteItem(uid, "results", r.id)} aria-label={`Delete ${r.title}`} className="text-on-surface-variant/40 hover:text-error p-1">
                    <span className="material-symbols-outlined text-[16px]">delete_outline</span>
                  </button>
                </div>
                <div className="grid grid-cols-[88px_1fr] items-center gap-x-2 gap-y-1 text-[11px] text-on-surface-variant">
                  <span>Score</span>
                  <div className="h-1.5 rounded-full bg-surface-container overflow-hidden"><div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                  <span data-testid="result-minutes">Studied {formatSmartDuration(minutesBefore)}</span>
                  <div className="h-1.5 rounded-full bg-surface-container overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(minutesBefore / maxMinutes) * 100}%`, background: barColor }} /></div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
