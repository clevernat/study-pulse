"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFlashcards } from "@/lib/firebase/useFlashcards";
import { useCollection } from "@/lib/firebase/useCollection";
import { updateItem } from "@/lib/firebase/firestore";
import { deleteNote } from "@/lib/firebase/flashcards";
import { buildQueue } from "@/lib/flashcards/queue";
import { notePreview } from "@/lib/flashcards/cloze";
import { formatInterval } from "@/lib/flashcards/scheduler";
import { localDateStr } from "@/lib/dateUtils";
import DeckModal from "@/components/flashcards/DeckModal";
import NoteForm from "@/components/flashcards/NoteForm";
import Modal from "@/components/ui/Modal";
import { inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import type { Card, Note, Subject } from "@/types";

const STATE = ["New", "Learning", "Review", "Relearning"];

function DeckView() {
  const id = useSearchParams().get("id") ?? "";
  const { uid, decks, notes, cards, logsToday, loading } = useFlashcards();
  const { items: subjects } = useCollection<Subject>("subjects");
  const [settings, setSettings] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [search, setSearch] = useState("");
  const deck = decks.find((d) => d.id === id);
  if (loading) return null;
  if (!deck) return <div className="glass-card p-8 text-center"><p>This deck does not exist.</p><Link href="/flashcards" className="text-primary underline">Back to Flashcards</Link></div>;

  const now = new Date();
  const q = buildQueue(cards, [deck], logsToday, now, localDateStr(now));
  const deckNotes = notes.filter((n) => n.deckId === id).sort((a, b) => b.createdAt - a.createdAt);
  const shown = deckNotes.filter((n) => !search || notePreview(n).toLowerCase().includes(search.toLowerCase()) || n.tags.some((t) => t.includes(search)));
  const cardsOf = (noteId: string) => cards.filter((c) => c.noteId === noteId).sort((a, b) => a.ord - b.ord);
  const toggleSuspend = (c: Card) => updateItem<Card>(uid, "cards", c.id, { suspended: !c.suspended });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/flashcards" aria-label="Back to Flashcards" className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">arrow_back</span></Link>
        <h1 data-testid="deck-title" className="font-grotesk font-bold text-2xl text-on-surface mr-auto">{deck.name}</h1>
        <button onClick={() => setSettings(true)} className={secondaryBtnCls} data-testid="deck-settings"><span className="material-symbols-outlined text-[18px]">tune</span>Settings</button>
        <Link href={`/flashcards/review?deck=${id}`} data-testid="deck-study-now" className={primaryBtnCls}>
          <span className="material-symbols-outlined text-[18px]">play_arrow</span>Study ({q.counts.learning + q.counts.review + q.counts.new})
        </Link>
      </div>
      <p className="text-xs text-on-surface-variant -mt-4">Up to {deck.newPerDay} new cards and {deck.reviewsPerDay} reviews per day · wanted memory {Math.round(deck.retention * 100)}%</p>

      <div className="glass-card p-5"><h2 className="font-grotesk font-bold text-lg text-on-surface mb-3">Add a card</h2><NoteForm uid={uid} deck={deck} cards={cards} /></div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-grotesk font-bold text-lg text-on-surface mr-auto">Cards ({cards.filter((c) => c.deckId === id).length})</h2>
          <input className={`${inputCls} !w-48`} placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {shown.map((n) => (
          <div key={n.id} data-testid="note-item" className="glass-card p-3 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm text-on-surface">{notePreview(n) || "(empty)"}</p>
              <button onClick={() => setEditing(n)} aria-label="Edit card" className="text-on-surface-variant hover:text-primary p-1"><span className="material-symbols-outlined text-[18px]">edit</span></button>
              <button onClick={() => confirm("Delete this note and its cards?") && deleteNote(uid, n.id)} aria-label="Delete card" className="text-on-surface-variant/50 hover:text-error p-1"><span className="material-symbols-outlined text-[18px]">delete_outline</span></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cardsOf(n.id).map((c) => (
                <button key={c.id} onClick={() => toggleSuspend(c)} title={c.suspended ? "Suspended. Tap to bring it back." : "Tap to suspend this card"}
                  className={`text-[10px] font-jetbrains px-2 py-0.5 rounded-full border ${c.suspended ? "border-tertiary/50 text-tertiary line-through" : "border-outline-variant text-on-surface-variant"}`}>
                  {n.type === "cloze" ? `c${c.ord}` : c.ord === 1 ? "reverse" : "card"} · {STATE[c.state]}{c.state === 2 ? ` · ${formatInterval(c.scheduled_days * 86_400_000)}` : ""}
                </button>
              ))}
              {n.tags.map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">#{t}</span>)}
            </div>
          </div>
        ))}
      </div>
      {settings && <DeckModal uid={uid} subjects={subjects} deck={deck} onClose={() => setSettings(false)} />}
      {editing && (
        <Modal title="Edit card" onClose={() => setEditing(null)}><NoteForm uid={uid} deck={deck} note={editing} cards={cards} onDone={() => setEditing(null)} /></Modal>
      )}
    </div>
  );
}

export default function DeckPage() {
  return <Suspense><DeckView /></Suspense>;
}
