"use client";
import { create } from "zustand";

// Lightweight in-memory channel for cross-component prompts.
// TimerSync writes a subjectId here when a focus session is saved; the
// CompletionToast component reads it, looks for matching open tasks, and
// surfaces the "Mark task done?" toast. Not persisted — prompts are
// ephemeral and shouldn't survive reloads.

interface PromptStore {
  pendingSubjectId: string | null;
  pendingAt: number; // timestamp — used to invalidate stale prompts
  setPending: (subjectId: string | null) => void;
}

export const usePromptStore = create<PromptStore>((set) => ({
  pendingSubjectId: null,
  pendingAt: 0,
  setPending: (subjectId) =>
    set({ pendingSubjectId: subjectId, pendingAt: subjectId ? Date.now() : 0 }),
}));
