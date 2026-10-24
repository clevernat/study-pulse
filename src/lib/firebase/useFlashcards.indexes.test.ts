// Every composite query in useFlashcards needs an index in firestore.indexes.json
// (the emulator does not check this, production does). Keep this list in sync.
import { readFileSync } from "fs";

const indexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes as { collectionGroup: string; fields: { fieldPath: string; order: string }[] }[];
const has = (col: string, ...fields: string[]) =>
  indexes.some((i) => i.collectionGroup === col && i.fields.map((f) => `${f.fieldPath}:${f.order}`).join(",") === fields.join(","));

test.each([
  ["cards due: state in + due range", "cards", ["state:ASCENDING", "due:ASCENDING"]],
  ["new cards of a deck, oldest first", "cards", ["deckId:ASCENDING", "state:ASCENDING", "createdAt:ASCENDING"]],
  ["mature count, all decks", "cards", ["state:ASCENDING", "scheduled_days:ASCENDING"]],
  ["mature count, one deck", "cards", ["deckId:ASCENDING", "state:ASCENDING", "scheduled_days:ASCENDING"]],
  ["newest notes of a deck", "notes", ["deckId:ASCENDING", "createdAt:DESCENDING"]],
  ["due reminders (server)", "reminders", ["sent:ASCENDING", "fireAt:ASCENDING"]],
])("index exists: %s", (_name, col, fields) => {
  expect(has(col as string, ...(fields as string[]))).toBe(true);
});
