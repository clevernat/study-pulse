import type { Note, NoteType } from "@/types";

// Cloze syntax: {{c1::answer}} or {{c1::answer::hint}}. Each number makes one card.
const CLOZE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

export function clozeNumbers(text: string): number[] {
  const set = new Set<number>();
  for (const m of text.matchAll(CLOZE)) set.add(Number(m[1]));
  return [...set].filter((n) => n > 0).sort((a, b) => a - b);
}

/**
 * Renders cloze text for card number `n`.
 * Front: that cloze is hidden as [hint] or [...]; other clozes show their answer.
 * Back: that cloze's answer is highlighted.
 */
export function renderCloze(text: string, n: number, side: "front" | "back"): string {
  return text.replace(CLOZE, (_all, num: string, answer: string, hint?: string) => {
    if (Number(num) !== n) return answer;
    return side === "front"
      ? `<span class="cloze-blank">[${hint ? hint : "..."}]</span>`
      : `<span class="cloze-answer">${answer}</span>`;
  });
}

/** Which card numbers (ords) a note makes. */
export function cardOrds(type: NoteType, fields: Note["fields"]): number[] {
  if (type === "cloze") return clozeNumbers(fields.text ?? "");
  if (type === "basicReverse") return [0, 1];
  return [0];
}

/** Front and back HTML for one card of a note (not yet sanitized). */
export function cardSides(note: Pick<Note, "type" | "fields">, ord: number): { front: string; back: string } {
  const f = note.fields;
  if (note.type === "cloze") {
    const extra = f.extra ? `<hr/>${f.extra}` : "";
    return { front: renderCloze(f.text ?? "", ord, "front"), back: renderCloze(f.text ?? "", ord, "back") + extra };
  }
  if (note.type === "basicReverse" && ord === 1) return { front: f.back ?? "", back: f.front ?? "" };
  return { front: f.front ?? "", back: f.back ?? "" };
}

/** Plain text typed in our form → safe HTML (line breaks kept). */
export function textToHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
}

/** HTML stored on a note → text for the edit form. */
export function htmlToText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
}

/** Short one-line preview of a note for lists. */
export function notePreview(note: Pick<Note, "type" | "fields">): string {
  const raw = note.type === "cloze" ? (note.fields.text ?? "").replace(CLOZE, "$2") : note.fields.front ?? "";
  return htmlToText(raw).replace(/\s+/g, " ").slice(0, 120);
}
