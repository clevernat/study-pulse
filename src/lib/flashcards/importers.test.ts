import { readFileSync } from "fs";
import path from "path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { readApkg, readCsv, stripMedia } from "./importers";

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, "../../../tests/fixtures", name)));

describe("readCsv", () => {
  it("reads front/back/tags, skips header and # lines, escapes plain text", () => {
    const r = readCsv("#separator:comma\nFront,Back,Tags\n2 < 3?,yes,math basics\n\"Paris, France\",capital\n,empty\n");
    expect(r.notes).toHaveLength(2);
    expect(r.notes[0]).toEqual({ deck: "", type: "basic", fields: { front: "2 &lt; 3?", back: "yes" }, tags: ["math", "basics"] });
    expect(r.notes[1].fields.front).toBe("Paris, France");
    expect(r.skipped).toBe(1);
  });
  it("detects cloze rows and tab separated files", () => {
    const r = readCsv("The {{c1::heart}} pumps blood\tBiology\nNo gap here {{c::x}}\t\n");
    expect(r.notes[0].type).toBe("cloze");
    expect(r.notes[0].fields).toEqual({ text: "The {{c1::heart}} pumps blood", extra: "Biology" });
    expect(r.skipped).toBe(1);
  });
});

describe("stripMedia", () => {
  it("replaces images and sounds", () => {
    expect(stripMedia('a <img src="x.jpg"> b [sound:y.mp3]')).toEqual({ html: "a [image] b [audio]", removed: 2 });
  });
});

describe.each([
  ["sample-legacy1.apkg", "Anki 2.0 (oldest format)"],
  ["sample-legacy2.apkg", "Anki 2.1 (older format)"],
  ["sample-latest.apkg", "Anki (current format)"],
])("readApkg %s", (file, format) => {
  it("reads decks, note types, fields and tags", () => {
    const r = readApkg(fixture(file), SQL);
    expect(r.format).toBe(format);
    expect(r.notes).toHaveLength(4);
    expect(r.skipped).toBe(0);
    expect(r.mediaRemoved).toBe(2);
    const [cat, dog, hola, cloze] = r.notes;
    expect(cat).toEqual({ deck: "Spanish::Animals", type: "basic", fields: { front: "el gato", back: "the cat" }, tags: ["animals"] });
    expect(dog.fields).toEqual({ front: "el perro [image]", back: "the dog [audio]" });
    expect(hola.type).toBe("basicReverse");
    expect(hola.deck).toBe("Spanish");
    expect(hola.tags).toEqual(["greetings", "basics"]);
    expect(cloze.type).toBe("cloze");
    expect(cloze.fields).toEqual({ text: "{{c1::Madrid}} is the capital of {{c2::Spain}}", extra: "Geography" });
  });
});

it("rejects files that are not Anki packages", () => {
  const { zipSync } = jest.requireActual("fflate") as typeof import("fflate");
  expect(() => readApkg(zipSync({ "readme.txt": new Uint8Array([1]) }), SQL)).toThrow("not an Anki deck package");
});
