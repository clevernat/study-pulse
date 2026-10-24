import { toCsv, parseCsv, detectDelimiter } from "./csv";

describe("toCsv", () => {
  it("quotes cells with commas, quotes and new lines", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", "line1\nline2", 3, null]])).toBe('a,"say ""hi""","x,y","line1\nline2",3,');
  });
});

describe("parseCsv", () => {
  it("reads quoted fields and escaped quotes", () => {
    expect(parseCsv('front,back\n"a, b","say ""hi"""\n')).toEqual([["front", "back"], ["a, b", 'say "hi"']]);
  });
  it("handles CRLF, BOM and multi-line cells", () => {
    expect(parseCsv('﻿q,a\r\n"two\nlines",x')).toEqual([["q", "a"], ["two\nlines", "x"]]);
  });
  it("skips empty lines and supports tabs", () => {
    expect(parseCsv("a\tb\n\nc\td", "\t")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("round-trips with toCsv", () => {
    const rows = [["x", 'y "z"', "1,2"], ["new\nline", "", "end"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("detectDelimiter", () => {
  it("finds tab, semicolon or comma", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a,b")).toBe(",");
  });
});
