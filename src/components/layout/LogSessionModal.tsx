"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNewSubject } from "@/components/ui/NewSubject";
import { useTimerStore } from "@/store/timerStore";
import { addSession } from "@/lib/firebase/firestore";
import type { Subject, Session, Topic } from "@/types";
import { localDateStr } from "@/lib/dateUtils";
import { useCollection } from "@/lib/firebase/useCollection";
import TopicSelect from "@/components/ui/TopicSelect";
import { FOCUS_RATINGS } from "@/components/ui/ReflectionModal";

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export default function LogSessionModal({ onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { selectedSubjectId } = useTimerStore();

  const { items: subjects } = useCollection<Subject>("subjects"); // live, so a new subject shows at once
  const [subjectId, setSubjectId] = useState(selectedSubjectId);
  const newSubject = useNewSubject((id) => setSubjectId(id));
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("25");
  const [focusRating, setFocusRating] = useState(0);
  const [topic, setTopic] = useState<Topic | null>(null);
  const { items: topics } = useCollection<Topic>("topics");
  const [date, setDate] = useState(localDateStr());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Falls back to the first subject when none (or a deleted one) is picked.
  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const totalMinutes = parseInt(hours || "0") * 60 + parseInt(minutes || "0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subjects.length === 0) { setError("Add a subject first before logging a session."); return; }
    if (!selectedSubject) { setError("Please select a subject."); return; }
    const h = parseInt(hours || "0");
    const m = parseInt(minutes || "0");
    if (isNaN(h) || h < 0 || h > 12) { setError("Hours must be between 0 and 12."); return; }
    if (isNaN(m) || m < 0 || m > 59) { setError("Minutes must be between 0 and 59."); return; }
    if (totalMinutes < 1) { setError("Duration must be at least 1 minute."); return; }
    if (!date) { setError("Please select a date."); return; }
    if (!user) return;

    setSaving(true);
    try {
      const now = new Date();
      const session: Omit<Session, "id"> = {
        uid: user.uid,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        subjectColor: selectedSubject.color ?? "violet",
        durationMinutes: totalMinutes,
        focusScore: 100,
        ...(focusRating ? { focusRating } : {}),
        ...(topic && topic.subjectId === selectedSubject.id ? { topicId: topic.id, topicTitle: topic.title } : {}),
        pomodoroCount: Math.floor(totalMinutes / 25),
        date,
        startTime: new Date(now.getTime() - totalMinutes * 60_000).toTimeString().slice(0, 5),
        endTime: now.toTimeString().slice(0, 5),
        notes,
      };
      await addSession(user.uid, session);
      onSaved?.();
      onClose();
    } catch {
      setError("Failed to save session. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-outline-variant rounded-2xl p-8 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-grotesk font-bold text-xl text-on-surface">Log study session</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Subject */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Subject *</label>
            {subjects.length === 0 ? (
              !newSubject.form && (
                <button type="button" onClick={newSubject.open} data-testid="log-new-subject"
                  className="w-full text-left text-sm text-primary bg-primary/5 border border-dashed border-primary/40 rounded-xl px-4 py-3 font-inter hover:bg-primary/10">
                  No subjects yet. + New subject
                </button>
              )
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubjectId(s.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      selectedSubject?.id === s.id
                        ? "border-primary bg-primary/10"
                        : "border-outline-variant hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        s.color === "primary" ? "text-primary" : s.color === "secondary" ? "text-secondary" : "text-tertiary"
                      }`}
                    >
                      {s.icon}
                    </span>
                    <span className="text-on-surface text-[13px] font-inter font-medium truncate">{s.name}</span>
                  </button>
                ))}
                <button type="button" onClick={newSubject.open} data-testid="log-new-subject"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-primary/40 text-primary text-[13px] font-inter font-medium hover:bg-primary/10">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>New subject
                </button>
              </div>
            )}
            {newSubject.form}
          </div>

          {selectedSubject && (
            <div>
              <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Topic (optional)</label>
              <TopicSelect subjectId={selectedSubject.id} topics={topics} value={topic?.id ?? ""} onChange={setTopic} testId="log-topic" />
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Duration</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  min="0"
                  max="12"
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm text-center"
                />
                <p className="text-center text-xs text-on-surface-variant mt-1">hours</p>
              </div>
              <span className="text-on-surface-variant font-bold text-xl mb-5">:</span>
              <div className="flex-1">
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  min="0"
                  max="59"
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm text-center"
                />
                <p className="text-center text-xs text-on-surface-variant mt-1">minutes</p>
              </div>
              <div className="flex-1">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-primary font-jetbrains text-sm text-center">
                  {totalMinutes}m
                </div>
                <p className="text-center text-xs text-on-surface-variant mt-1">total</p>
              </div>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Focus rating */}
          <div>
            <p id="log-focus-label" className="text-on-surface-variant text-sm font-inter mb-1.5">How focused were you? (optional)</p>
            <div role="radiogroup" aria-labelledby="log-focus-label" className="grid grid-cols-5 gap-1.5">
              {FOCUS_RATINGS.map((r) => (
                <button key={r.value} type="button" role="radio" aria-checked={focusRating === r.value} aria-label={`${r.value}: ${r.label}`}
                  onClick={() => setFocusRating(focusRating === r.value ? 0 : r.value)}
                  className={`rounded-xl border py-2 flex flex-col items-center gap-0.5 transition-all ${
                    focusRating === r.value ? "bg-primary/20 border-primary text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/50"
                  }`}>
                  <span className="font-jetbrains font-bold text-sm">{r.value}</span>
                  <span className="text-[10px] leading-tight text-center">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you cover? Any blockers?"
              rows={2}
              maxLength={200}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40 resize-none"
            />
          </div>

          {error && (
            <p className="text-error text-sm font-inter bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all font-inter text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || subjects.length === 0}
              className="flex-1 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <span className="w-4 h-4 rounded-full border-2 border-on-primary-container border-t-transparent animate-spin" />}
              Log Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
