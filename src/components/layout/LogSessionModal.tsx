"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTimerStore } from "@/store/timerStore";
import { getUserSubjects, addSession } from "@/lib/firebase/firestore";
import type { Subject, Session } from "@/types";

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export default function LogSessionModal({ onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { selectedSubjectId, selectedSubjectName } = useTimerStore();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState(selectedSubjectId);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("25");
  const [focusScore, setFocusScore] = useState("85");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserSubjects(user.uid).then(setSubjects);
  }, [user]);

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const totalMinutes = parseInt(hours || "0") * 60 + parseInt(minutes || "0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId && subjects.length > 0) { setError("Please select a subject."); return; }
    if (totalMinutes < 1) { setError("Duration must be at least 1 minute."); return; }
    const score = parseInt(focusScore);
    if (isNaN(score) || score < 1 || score > 100) { setError("Focus score must be between 1 and 100."); return; }
    if (!user) return;

    setSaving(true);
    try {
      const now = new Date();
      const session: Omit<Session, "id"> = {
        uid: user.uid,
        subjectId: selectedSubject?.id ?? subjectId ?? "manual",
        subjectName: selectedSubject?.name ?? selectedSubjectName ?? "General",
        subjectColor: (selectedSubject?.color ?? "primary") as Session["subjectColor"],
        durationMinutes: totalMinutes,
        focusScore: score,
        pomodoroCount: Math.floor(totalMinutes / 25),
        date,
        startTime: now.toTimeString().slice(0, 5),
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
        className="relative bg-[#12121a] border border-[#252535] rounded-2xl p-8 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-grotesk font-bold text-xl text-on-surface">Log Study Session</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Subject */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 block">Subject *</label>
            {subjects.length === 0 ? (
              <p className="text-on-surface-variant text-sm font-inter bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3">
                No subjects yet — add one in Subjects first
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubjectId(s.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      subjectId === s.id
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
              </div>
            )}
          </div>

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
                  className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm text-center"
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
                  className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm text-center"
                />
                <p className="text-center text-xs text-on-surface-variant mt-1">minutes</p>
              </div>
              <div className="flex-1">
                <div className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-primary font-jetbrains text-sm text-center">
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
              className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Focus Score */}
          <div>
            <label className="text-on-surface-variant text-sm font-inter mb-1.5 flex items-center justify-between">
              <span>Focus Score</span>
              <span className="font-jetbrains text-primary font-bold">{focusScore}%</span>
            </label>
            <input
              type="range"
              value={focusScore}
              onChange={(e) => setFocusScore(e.target.value)}
              min="1"
              max="100"
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-on-surface-variant mt-1 font-inter">
              <span>Distracted</span>
              <span>Moderate</span>
              <span>Deep focus</span>
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
              className="bg-[#0e0e11] border border-outline-variant rounded-xl px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40 resize-none"
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
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
