"use client";
import { useRef, useState } from "react";
import { inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import { addNotes, updateNote } from "@/lib/firebase/flashcards";
import { cardOrds, clozeNumbers, htmlToText, textToHtml } from "@/lib/flashcards/cloze";
import CardHtml from "./CardHtml";
import { cardSides } from "@/lib/flashcards/cloze";
import type { Card, Deck, Note, NoteType } from "@/types";

const TYPES: { value: NoteType; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "basicReverse", label: "Basic + reverse" },
  { value: "cloze", label: "Cloze (fill the gap)" },
];

/** Add a new note to a deck, or edit an existing one. */
export default function NoteForm({ uid, deck, note, cards, onDone }: { uid: string; deck: Deck; note?: Note; cards: Card[]; onDone?: () => void }) {
  const [type, setType] = useState<NoteType>(note?.type ?? "basic");
  const [front, setFront] = useState(htmlToText(note?.fields.front ?? note?.fields.text ?? ""));
  const [back, setBack] = useState(htmlToText(note?.fields.back ?? note?.fields.extra ?? ""));
  const [tags, setTags] = useState((note?.tags ?? []).join(" "));
  const [message, setMessage] = useState("");
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const isCloze = type === "cloze";
  // Imported notes may contain formatting; editing them as plain text would drop it, so show a note.
  const hasHtml = !!note && /<(?!br)[a-z]/i.test(note.fields.front ?? note.fields.text ?? "");

  function fields(): Note["fields"] {
    return isCloze ? { text: textToHtml(front), extra: back ? textToHtml(back) : "" } : { front: textToHtml(front), back: textToHtml(back) };
  }

  /** Wraps the selected text in the next cloze number. */
  function makeCloze() {
    const el = frontRef.current;
    if (!el) return;
    const n = (clozeNumbers(front).at(-1) ?? 0) + 1;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const sel = front.slice(a, b) || "answer";
    setFront(front.slice(0, a) + `{{c${n}::${sel}}}` + front.slice(b));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim()) return setMessage(isCloze ? "Write the text." : "Write the front.");
    if (!isCloze && !back.trim()) return setMessage("Write the back.");
    if (isCloze && cardOrds("cloze", fields()).length === 0) return setMessage("Add at least one gap like {{c1::answer}}. Select a word and press [...].");
    const tagList = tags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    if (note) {
      await updateNote(uid, note, fields(), tagList, cards);
      onDone?.();
    } else {
      // Clear the form at once, so the next card can be typed while this one saves.
      const note = { deckId: deck.id, subjectId: deck.subjectId, type, fields: fields(), tags: tagList };
      setFront(""); setBack(""); setMessage("");
      frontRef.current?.focus();
      const made = await addNotes(uid, [note]);
      setMessage(`Added ${made} card${made === 1 ? "" : "s"}.`);
    }
  }

  const preview = front.trim() ? cardSides({ type, fields: fields() }, isCloze ? clozeNumbers(front)[0] ?? 1 : 0) : null;

  return (
    <form onSubmit={save} className="flex flex-col gap-3" data-testid="note-form">
      <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Card type">
        {TYPES.map((t) => (
          <button key={t.value} type="button" role="radio" aria-checked={type === t.value} disabled={!!note} data-testid={`note-type-${t.value}`}
            onClick={() => setType(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${type === t.value ? "bg-primary/15 text-primary border-primary/50" : "border-outline-variant text-on-surface-variant"} disabled:opacity-50`}>
            {t.label}
          </button>
        ))}
      </div>
      {hasHtml && <p className="text-[11px] text-tertiary">This card came from an import. Saving here keeps only the text, not its formatting.</p>}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-on-surface-variant font-bold">{isCloze ? "Text" : "Front"}</span>
          {isCloze && <button type="button" data-testid="note-make-cloze" onClick={makeCloze} className="text-xs text-primary font-bold px-2 py-0.5 rounded border border-primary/40" title="Hide the selected words">[...]</button>}
        </div>
        <textarea ref={frontRef} data-testid="note-front" className={`${inputCls} min-h-[80px]`} value={front} onChange={(e) => setFront(e.target.value)}
          placeholder={isCloze ? "The {{c1::mitochondria}} is the powerhouse of the cell." : "Question"} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-on-surface-variant font-bold">{isCloze ? "Extra (optional)" : "Back"}</span>
        <textarea data-testid="note-back" className={`${inputCls} min-h-[60px]`} value={back} onChange={(e) => setBack(e.target.value)} placeholder={isCloze ? "Shown with the answer" : "Answer"} />
      </div>
      <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (optional), e.g. chapter1 exam" />
      {preview && (
        <div className="rounded-xl border border-outline-variant/50 p-3 text-sm text-on-surface">
          <p className="text-xs text-on-surface-variant mb-1">Preview (front)</p>
          <CardHtml html={preview.front} />
        </div>
      )}
      {message && <p data-testid="note-message" className="text-sm text-on-surface-variant">{message}</p>}
      <div className="flex gap-2">
        {note && <button type="button" onClick={onDone} className={`${secondaryBtnCls} flex-1`}>Cancel</button>}
        <button type="submit" data-testid="note-save" className={`${primaryBtnCls} flex-1`}>{note ? "Save card" : "Add card"}</button>
      </div>
    </form>
  );
}
