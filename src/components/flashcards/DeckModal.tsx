"use client";
import { useState } from "react";
import { useNewSubject } from "@/components/ui/NewSubject";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { Field, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import { addItem, updateItem } from "@/lib/firebase/firestore";
import { DEFAULT_DECK, deleteDeck } from "@/lib/firebase/flashcards";
import type { Deck, Subject } from "@/types";

export default function DeckModal({ uid, subjects, deck, onClose, defaultSubjectId }: { uid: string; subjects: Subject[]; deck?: Deck; onClose: () => void; defaultSubjectId?: string }) {
  const router = useRouter();
  const [name, setName] = useState(deck?.name ?? "");
  const [pickedSubjectId, setSubjectId] = useState(deck?.subjectId ?? defaultSubjectId ?? "");
  const newSubject = useNewSubject((id) => { setSubjectId(id); });
  // Subjects may load after the form opens: fall back to the first one (the select shows it).
  const subjectId = pickedSubjectId || subjects[0]?.id || "";
  const [newPerDay, setNewPerDay] = useState(deck?.newPerDay ?? DEFAULT_DECK.newPerDay);
  const [reviewsPerDay, setReviewsPerDay] = useState(deck?.reviewsPerDay ?? DEFAULT_DECK.reviewsPerDay);
  const [retention, setRetention] = useState(Math.round((deck?.retention ?? DEFAULT_DECK.retention) * 100));
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the deck a name.");
    if (!subjectId) return setError("Add a subject first. Each deck belongs to a subject.");
    if (!(newPerDay >= 0 && newPerDay <= 9999 && reviewsPerDay >= 0 && reviewsPerDay <= 9999)) return setError("Limits must be 0–9999.");
    const data = { name: name.trim().slice(0, 80), subjectId, newPerDay, reviewsPerDay, retention: Math.min(97, Math.max(70, retention)) / 100 };
    if (deck) await updateItem<Deck>(uid, "decks", deck.id, data);
    else {
      const id = await addItem<Deck>(uid, "decks", { ...data, createdAt: Date.now() });
      router.push(`/flashcards/deck?id=${id}`);
    }
    onClose();
  }

  async function remove() {
    if (!deck || !confirm(`Delete the deck "${deck.name}" with all its cards and review history?`)) return;
    await deleteDeck(uid, deck.id);
    onClose();
    router.push("/flashcards");
  }

  return (
    <Modal title={deck ? "Deck settings" : "New deck"} onClose={onClose} testId="deck-modal">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Name"><input data-testid="deck-name" className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Biology – cells" /></Field>
        <Field label="Subject">
          <select data-testid="deck-subject" className={inputCls} value={subjectId} onChange={(e) => newSubject.pick(e.target.value) || setSubjectId(e.target.value)}>
            {subjects.length === 0 && <option value="">No subjects yet</option>}
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {newSubject.option}
          </select>
        </Field>
        {newSubject.form}
        <div className="grid grid-cols-2 gap-3">
          <Field label="New cards / day"><input data-testid="deck-new-limit" type="number" min={0} max={9999} className={inputCls} value={newPerDay} onChange={(e) => setNewPerDay(Number(e.target.value))} /></Field>
          <Field label="Reviews / day"><input data-testid="deck-review-limit" type="number" min={0} max={9999} className={inputCls} value={reviewsPerDay} onChange={(e) => setReviewsPerDay(Number(e.target.value))} /></Field>
        </div>
        <Field label={`Wanted memory: ${retention}%`}>
          <input type="range" min={70} max={97} value={retention} onChange={(e) => setRetention(Number(e.target.value))} />
          <span className="text-[11px] text-on-surface-variant normal-case tracking-normal font-normal">Higher means more reviews. 90% is a good default.</span>
        </Field>
        {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2">
          {deck && <button type="button" onClick={remove} className={`${secondaryBtnCls} text-error`} aria-label="Delete deck"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>Delete</button>}
          <button type="button" onClick={onClose} className={`${secondaryBtnCls} flex-1`}>Cancel</button>
          <button type="submit" data-testid="deck-save" className={`${primaryBtnCls} flex-1`}>{deck ? "Save" : "Create deck"}</button>
        </div>
      </form>
    </Modal>
  );
}
