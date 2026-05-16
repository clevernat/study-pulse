"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeTasks, subscribeSubjects, updateTask } from "@/lib/firebase/firestore";
import { usePromptStore } from "@/store/promptStore";
import { getColor } from "@/lib/colorPalette";
import type { Task, Subject } from "@/types";

// Auto-dismiss timing
const AUTO_DISMISS_MS = 20_000;

export default function CompletionToast() {
  const { user } = useAuth();
  const pendingSubjectId = usePromptStore((s) => s.pendingSubjectId);
  const pendingAt = usePromptStore((s) => s.pendingAt);
  const setPending = usePromptStore((s) => s.setPending);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dismissedFor, setDismissedFor] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeTasks(user.uid, setTasks);
    const unsub2 = subscribeSubjects(user.uid, setSubjects);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Find the most recent open task for the pending subject.
  const candidate = useMemo<Task | null>(() => {
    if (!pendingSubjectId) return null;
    if (pendingAt === dismissedFor) return null;
    const matches = tasks
      .filter((t) => !t.completed && t.subjectId === pendingSubjectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  }, [pendingSubjectId, pendingAt, dismissedFor, tasks]);

  // Auto-dismiss after a window
  useEffect(() => {
    if (!candidate) return;
    const id = setTimeout(() => {
      setDismissedFor(pendingAt);
      setPending(null);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [candidate, pendingAt, setPending]);

  if (!candidate) return null;

  const subject = subjects.find((s) => s.id === candidate.subjectId);
  const dot = subject ? getColor(subject.color).dot : null;

  function dismiss() {
    setDismissedFor(pendingAt);
    setPending(null);
  }

  async function markDone() {
    if (!user || !candidate) return;
    try {
      await updateTask(user.uid, candidate.id, { completed: true });
    } finally {
      dismiss();
    }
  }

  return (
    <div
      className="fixed bottom-24 md:bottom-6 left-1/2 z-[200] w-[calc(100vw-2rem)] max-w-md"
      style={{ animation: "sp-toast-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both", transform: "translateX(-50%)" }}
    >
      <style>{`@keyframes sp-toast-in {
        from { opacity: 0; transform: translate(-50%, 12px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
      }`}</style>
      <div className="glass-card p-4 shadow-[0_8px_40px_rgba(0,0,0,0.6)] border-primary/40">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary/15 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold">
              Focus complete
            </div>
            <div className="text-sm text-on-surface font-inter mt-1">
              Did you finish <span className="font-semibold">&ldquo;{candidate.title}&rdquo;</span>?
            </div>
            {subject && (
              <div className="flex items-center gap-1.5 mt-1">
                {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
                <span className="text-[11px] text-on-surface-variant">{subject.name}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface text-xs font-inter font-semibold transition-all"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={markDone}
            className="flex-1 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-inter font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Mark done
          </button>
        </div>
      </div>
    </div>
  );
}
