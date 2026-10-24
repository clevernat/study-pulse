"use client";
import { useState } from "react";
import Link from "next/link";
import { useCollection } from "@/lib/firebase/useCollection";
import { addItem } from "@/lib/firebase/firestore";
import { addNotes, DEFAULT_DECK } from "@/lib/firebase/flashcards";
import { Field, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/ui/Field";
import type { ImportResult } from "@/lib/flashcards/importers";
import type { WorkerReply } from "@/lib/flashcards/import.worker";
import type { Deck, Subject } from "@/types";

const MAX_BYTES = 80 * 1024 * 1024;

function readInWorker(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("@/lib/flashcards/import.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.result); else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || "Could not read the file.")); };
    file.arrayBuffer().then((bytes) => worker.postMessage({ name: file.name, bytes }, [bytes]));
  });
}

export default function ImportPage() {
  const { items: subjects, uid } = useCollection<Subject>("subjects");
  const { items: decks } = useCollection<Deck>("decks");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "saving" | "done">("idle");
  const [error, setError] = useState("");
  const [target, setTarget] = useState<"new" | string>("new");
  const [subjectId, setSubjectId] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(""); setResult(null); setSummary(""); setFileName(file.name);
    if (file.size > MAX_BYTES) return setError("This file is too big (over 80 MB). Export the deck without media and try again.");
    if (!/\.(apkg|csv|tsv|txt)$/i.test(file.name)) return setError("Choose an Anki .apkg file or a CSV/TSV text file.");
    setStatus("reading");
    try {
      const r = await readInWorker(file);
      setResult(r);
      if (r.notes.length === 0) setError("No cards found in this file.");
    } catch (err) {
      setError(`Could not read the file: ${(err as Error).message}. If it is from a new Anki version, export again with "Support older Anki versions" checked.`);
    } finally {
      setStatus("idle");
    }
  }

  // Deck names in the file (Anki subdecks keep their "Parent::Child" name).
  const fileDecks = result ? [...new Set(result.notes.map((n) => n.deck || fileName.replace(/\.[^.]+$/, "")))] : [];

  async function save() {
    if (!result) return;
    const sid = subjectId || subjects[0]?.id;
    if (target === "new" && !sid) return setError("Add a subject first.");
    setStatus("saving"); setProgress(0);
    const deckIds = new Map<string, Deck>();
    if (target === "new") {
      for (const name of fileDecks) {
        const data = { name: name.slice(0, 80), subjectId: sid!, ...DEFAULT_DECK, createdAt: Date.now() };
        const id = await addItem<Deck>(uid, "decks", data);
        deckIds.set(name, { id, ...data });
      }
    }
    const existing = decks.find((d) => d.id === target);
    const notes = result.notes.map((n) => {
      const deck = existing ?? deckIds.get(n.deck || fileName.replace(/\.[^.]+$/, ""))!;
      return { deckId: deck.id, subjectId: deck.subjectId, type: n.type, fields: n.fields, tags: n.tags, source: (/\.apkg$/i.test(fileName) ? "apkg" : "csv") as "apkg" | "csv" };
    });
    const made = await addNotes(uid, notes, (done) => setProgress(Math.round((done / notes.length) * 100)));
    setSummary(`Imported ${notes.length} notes as ${made} cards${target === "new" ? ` into ${fileDecks.length} deck${fileDecks.length === 1 ? "" : "s"}` : ""}.`);
    setStatus("done");
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/flashcards" aria-label="Back to Flashcards" className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">arrow_back</span></Link>
        <h1 className="font-grotesk font-bold text-2xl text-on-surface">Import cards</h1>
      </div>

      <div className="glass-card p-5 flex flex-col gap-3 text-sm text-on-surface-variant">
        <p><b className="text-on-surface">Anki deck (.apkg):</b> in Anki, choose a deck → Export → &quot;Anki Deck Package&quot;. Cards come in as new cards (your Anki review history is not copied). Images and sounds are left out.</p>
        <p><b className="text-on-surface">CSV or TSV:</b> one card per line: <code>front, back, tags</code>. A line with <code>{"{{c1::...}}"}</code> becomes a cloze card.</p>
        <label className={`${primaryBtnCls} self-start cursor-pointer`}>
          <span className="material-symbols-outlined text-[18px]">upload_file</span>Choose file
          <input data-testid="import-file" type="file" accept=".apkg,.csv,.tsv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {status === "reading" && <p data-testid="import-reading">Reading {fileName}…</p>}
        {error && <p data-testid="import-error" className="text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
      </div>

      {result && result.notes.length > 0 && status !== "done" && (
        <div className="glass-card p-5 flex flex-col gap-4" data-testid="import-preview">
          <p className="text-on-surface">
            <b>{result.notes.length}</b> notes found in <b>{fileName}</b> ({result.format}).
            {result.skipped > 0 && ` ${result.skipped} empty or broken notes will be skipped.`}
            {result.mediaRemoved > 0 && ` ${result.mediaRemoved} images/sounds will be left out.`}
          </p>
          <ul className="text-xs text-on-surface-variant list-disc pl-5">
            {fileDecks.slice(0, 8).map((d) => <li key={d}>{d}: {result.notes.filter((n) => (n.deck || fileName.replace(/\.[^.]+$/, "")) === d).length} notes</li>)}
          </ul>
          <Field label="Put the cards into">
            <select data-testid="import-target" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="new">New deck(s) with the names from the file</option>
              {decks.map((d) => <option key={d.id} value={d.id}>Existing deck: {d.name}</option>)}
            </select>
          </Field>
          {target === "new" && (
            <Field label="Subject for the new deck(s)">
              <select data-testid="import-subject" className={inputCls} value={subjectId || subjects[0]?.id || ""} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.length === 0 && <option value="">No subjects yet</option>}
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          {status === "saving" ? (
            <div className="flex flex-col gap-1" data-testid="import-progress">
              <div className="h-2 rounded-full bg-[#1a1a24] overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="text-xs text-on-surface-variant">Saving… {progress}%</p>
            </div>
          ) : (
            <button data-testid="import-save" onClick={save} className={primaryBtnCls}>Import {result.notes.length} notes</button>
          )}
        </div>
      )}

      {status === "done" && (
        <div className="glass-card p-5 flex flex-col gap-3" data-testid="import-done">
          <p className="text-on-surface">{summary}</p>
          <div className="flex gap-2">
            <Link href="/flashcards" className={primaryBtnCls}>Go to decks</Link>
            <button onClick={() => { setResult(null); setStatus("idle"); setFileName(""); }} className={secondaryBtnCls}>Import another file</button>
          </div>
        </div>
      )}
    </div>
  );
}
