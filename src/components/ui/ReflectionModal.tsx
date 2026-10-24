"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useReflectionStore } from "@/store/reflectionStore";
import { updateSession } from "@/lib/firebase/firestore";

export default function ReflectionModal() {
  const { user } = useAuth();
  const { show, sessionId, subjectName, close } = useReflectionStore();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!show) return null;

  const handleSave = async () => {
    if (!user || !sessionId || !notes.trim()) { close(); setNotes(""); return; }
    setSaving(true);
    try {
      await updateSession(user.uid, sessionId, { notes: notes.trim() });
    } catch {
      // fail silently — reflection is optional
    } finally {
      setSaving(false);
      close();
      setNotes("");
    }
  };

  const handleSkip = () => { close(); setNotes(""); };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />
      <div
        className="relative bg-[#12121a] border border-[#252535] rounded-2xl p-7 w-full max-w-md shadow-2xl flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <span className="text-xs uppercase tracking-widest font-bold text-secondary">Session Complete</span>
            </div>
            <h2 className="font-grotesk font-bold text-xl text-on-surface">Reflection</h2>
            {subjectName && subjectName !== "Select a Focus Area" && (
              <p className="text-sm text-on-surface-variant mt-0.5">{subjectName}</p>
            )}
          </div>
          <button onClick={handleSkip} className="text-on-surface-variant hover:text-on-surface transition-colors mt-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-on-surface-variant font-inter">
            What did you work on? What did you get done?
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Finished the intro section, still need to add citations tomorrow…"
            rows={4}
            maxLength={500}
            autoFocus
            className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40 resize-none"
          />
          <p className="text-xs text-on-surface-variant/50 text-right">{notes.length}/500</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all font-inter text-sm font-semibold"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !notes.trim()}
            className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <span className="w-4 h-4 rounded-full border-2 border-on-primary-container border-t-transparent animate-spin" />}
            Save Reflection
          </button>
        </div>
      </div>
    </div>
  );
}
