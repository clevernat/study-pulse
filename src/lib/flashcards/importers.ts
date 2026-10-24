// Readers for flashcard files. Pure functions (no Firestore), used by the import page.
import { unzipSync, strFromU8 } from "fflate";
import { decompress } from "fzstd";
import type { SqlJsStatic, Database } from "sql.js";
import { parseCsv, detectDelimiter } from "@/lib/csv";
import { clozeNumbers, textToHtml } from "./cloze";
import type { Note, NoteType } from "@/types";

export interface ImportedNote {
  /** Deck path, levels joined with "::" ("" = no deck in the file) */
  deck: string;
  type: NoteType;
  fields: Note["fields"];
  tags: string[];
}

export interface ImportResult {
  notes: ImportedNote[];
  /** Notes that could not be used (empty, or no gap in a cloze) */
  skipped: number;
  /** Images and sounds were left out */
  mediaRemoved: number;
  format: string;
}

const CLOZE_RE = /\{\{c\d+::/;

/** Images and sounds are not imported; they are replaced by a short label. */
export function stripMedia(html: string): { html: string; removed: number } {
  let removed = 0;
  const out = html
    .replace(/<img\b[^>]*>/gi, () => { removed++; return "[image]"; })
    .replace(/\[sound:[^\]]*\]/g, () => { removed++; return "[audio]"; })
    .replace(/<(audio|video)\b[\s\S]*?<\/\1>/gi, () => { removed++; return "[media]"; });
  return { html: out, removed };
}

function makeNote(deck: string, a: string, b: string, tags: string[], forceType?: NoteType): { note?: ImportedNote; removed: number } {
  const fa = stripMedia(a), fb = stripMedia(b);
  const removed = fa.removed + fb.removed;
  const isCloze = forceType === "cloze" || CLOZE_RE.test(fa.html);
  if (isCloze) {
    if (clozeNumbers(fa.html).length === 0) return { removed };
    return { note: { deck, type: "cloze", fields: { text: fa.html, extra: fb.html }, tags }, removed };
  }
  if (!fa.html.trim() || !fb.html.trim()) return { removed };
  return { note: { deck, type: forceType ?? "basic", fields: { front: fa.html, back: fb.html }, tags }, removed };
}

/**
 * CSV / TSV: front, back, optional tags. A header row (front/back/question/answer)
 * is skipped, and so are Anki text-export lines that start with "#".
 * Plain text is escaped; text that already looks like HTML is kept.
 */
export function readCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => !l.startsWith("#")).join("\n");
  const rows = parseCsv(lines, detectDelimiter(lines));
  const out: ImportResult = { notes: [], skipped: 0, mediaRemoved: 0, format: "CSV" };
  rows.forEach((r, i) => {
    if (i === 0 && /^(front|question|q|term|text)$/i.test((r[0] ?? "").trim())) return;
    const html = (s: string) => (/<[a-z][\s\S]*>/i.test(s) ? s : textToHtml(s.trim()));
    const { note, removed } = makeNote("", html(r[0] ?? ""), html(r[1] ?? ""), (r[2] ?? "").split(/\s+/).filter(Boolean));
    out.mediaRemoved += removed;
    if (note) out.notes.push(note); else out.skipped++;
  });
  return out;
}

function rows(db: Database, sql: string): Record<string, unknown>[] {
  const res = db.exec(sql)[0];
  if (!res) return [];
  return res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]])));
}

/**
 * Newer Anki files declare a custom text sort order ("unicase") that sql.js
 * does not have. Remove it from the stored table definitions (in this
 * in-memory copy only) and reopen.
 */
function withoutUnicase(SQL: SqlJsStatic, bytes: Uint8Array): Database {
  const db = new SQL.Database(bytes);
  db.exec("PRAGMA writable_schema = ON;");
  db.exec("UPDATE sqlite_master SET sql = replace(replace(sql, ' COLLATE unicase', ''), ' collate unicase', '') WHERE sql LIKE '%unicase%';");
  // Indexes were sorted with the old order; we only read, so drop them from this copy.
  db.exec("DELETE FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL;");
  db.exec("PRAGMA writable_schema = OFF;");
  const fixed = db.export();
  db.close();
  return new SQL.Database(fixed);
}

/** Reads an Anki .apkg (all 3 versions). Scheduling history is not kept: cards start as new. */
export function readApkg(file: Uint8Array, SQL: SqlJsStatic): ImportResult {
  const zip = unzipSync(file);
  let bytes: Uint8Array, format: string, latest = false;
  if (zip["collection.anki21b"]) { bytes = decompress(zip["collection.anki21b"]); format = "Anki (current format)"; latest = true; }
  else if (zip["collection.anki21"]) { bytes = zip["collection.anki21"]; format = "Anki 2.1 (older format)"; }
  else if (zip["collection.anki2"]) { bytes = zip["collection.anki2"]; format = "Anki 2.0 (oldest format)"; }
  else throw new Error("This file is not an Anki deck package (.apkg).");

  const db = latest ? withoutUnicase(SQL, bytes) : new SQL.Database(bytes);
  try {
    // Note types: is it cloze? how many card templates?
    const models = new Map<number, { cloze: boolean; templates: number }>();
    const decks = new Map<number, string>();
    if (latest) {
      for (const r of rows(db, "SELECT ntid, COUNT(*) AS n FROM templates GROUP BY ntid")) models.set(Number(r.ntid), { cloze: false, templates: Number(r.n) });
      for (const r of rows(db, "SELECT n.id AS id, n.name AS name FROM notetypes n")) {
        const m = models.get(Number(r.id)) ?? { cloze: false, templates: 1 };
        models.set(Number(r.id), { ...m, cloze: /cloze/i.test(String(r.name)) });
      }
      for (const r of rows(db, "SELECT id, name FROM decks")) decks.set(Number(r.id), String(r.name).split("\x1f").join("::"));
    } else {
      const col = rows(db, "SELECT models, decks FROM col")[0];
      const m = JSON.parse(String(col?.models ?? "{}")) as Record<string, { type?: number; tmpls?: unknown[] }>;
      for (const [id, v] of Object.entries(m)) models.set(Number(id), { cloze: v.type === 1, templates: v.tmpls?.length ?? 1 });
      const d = JSON.parse(String(col?.decks ?? "{}")) as Record<string, { name: string }>;
      for (const [id, v] of Object.entries(d)) decks.set(Number(id), v.name);
    }

    const deckOfNote = new Map<number, number>();
    for (const r of rows(db, "SELECT nid, MIN(did) AS did FROM cards GROUP BY nid")) deckOfNote.set(Number(r.nid), Number(r.did));

    const out: ImportResult = { notes: [], skipped: 0, mediaRemoved: 0, format };
    for (const r of rows(db, "SELECT id, mid, flds, tags FROM notes ORDER BY id")) {
      const fields = String(r.flds ?? "").split("\x1f");
      const model = models.get(Number(r.mid)) ?? { cloze: false, templates: 1 };
      const type: NoteType | undefined = model.cloze ? "cloze" : model.templates >= 2 ? "basicReverse" : undefined;
      const deck = decks.get(deckOfNote.get(Number(r.id)) ?? -1) ?? "";
      const tags = String(r.tags ?? "").trim().split(/\s+/).filter(Boolean);
      const { note, removed } = makeNote(deck, fields[0] ?? "", fields.slice(1).join("<br>"), tags, type);
      out.mediaRemoved += removed;
      if (note) out.notes.push(note); else out.skipped++;
    }
    return out;
  } finally {
    db.close();
  }
}

export { strFromU8 };
