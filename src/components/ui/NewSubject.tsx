"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addSubject } from "@/lib/firebase/firestore";
import { getColor } from "@/lib/colorPalette";
import { localDateStr } from "@/lib/dateUtils";

/** Value of the "+ New subject" option in a subject <select>. */
export const NEW_SUBJECT = "__new_subject";

const COLORS = ["violet", "emerald", "amber", "rose", "blue", "cyan", "orange", "pink"];

/** Small inline form: type a name, pick a color, the subject is created and handed back. */
export function NewSubjectForm({ onCreated, onCancel }: { onCreated: (id: string, name: string) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [saving, setSaving] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n || !user || saving) return;
    setSaving(true);
    try {
      const id = await addSubject(user.uid, { uid: user.uid, name: n, icon: "school", color, category: "STEM", totalMinutes: 0, sessionCount: 0, createdAt: localDateStr() });
      onCreated(id, n);
    } finally {
      setSaving(false);
    }
  }

  // A <div>, not a <form>: it sits inside other forms.
  return (
    <div data-testid="new-subject" className="flex flex-col gap-2.5 rounded-xl border border-primary/40 bg-primary/5 p-3 mt-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-on-surface-variant font-bold">New subject name</span>
        <input data-testid="new-subject-name" autoFocus value={name} maxLength={60} placeholder="e.g. Biology"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); create(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary placeholder:text-on-surface-variant/40" />
      </label>
      <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={getColor(c).label} onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-offset-background ring-on-surface scale-110" : ""}`}
            style={{ background: getColor(c).dot }} />
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" data-testid="new-subject-save" onClick={create} disabled={!name.trim() || saving}
          className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">
          {saving ? "Adding…" : "Add subject"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-xl text-sm text-on-surface-variant hover:text-on-surface">Cancel</button>
      </div>
    </div>
  );
}

/**
 * "+ New subject" for a subject <select>: put `option` last in the select, call
 * `pick(value)` first in its onChange (true = it opened the form), and render `form` below.
 */
export function useNewSubject(onCreated: (id: string, name: string) => void) {
  const [open, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    pick: (value: string) => { if (value !== NEW_SUBJECT) return false; setOpen(true); return true; },
    option: <option value={NEW_SUBJECT}>+ New subject…</option>,
    form: open ? <NewSubjectForm onCreated={(id, name) => { setOpen(false); onCreated(id, name); }} onCancel={() => setOpen(false)} /> : null,
  };
}
