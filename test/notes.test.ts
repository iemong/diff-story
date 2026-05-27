import type { DiffFile, Note } from "../src/types";
import { anchorNotes, anchorableLines, renderNoteLine, renderWithNotes } from "../src/notes";
import { describe, expect, test } from "bun:test";

const LINE_ADDED = 1;
const LINE_CONTEXT = 2;
const LINE_GHOST = 99;

const RAW = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,2 +1,2 @@",
  "-const a = 1;",
  "+const a = 2;",
  " export default a;",
].join("\n");

const fileOf = (path: string, rawText: string): DiffFile => ({
  additions: 1,
  binary: false,
  deletions: 1,
  from: path,
  path,
  rawText,
  to: path,
});

const note = (line: number, over: Partial<Note> = {}): Note => ({
  body: "comment",
  file: "src/a.ts",
  kind: "issue",
  line,
  ...over,
});

describe("anchorableLines", () => {
  test("collects added and context line numbers, not deletions", () => {
    const lines = anchorableLines(RAW);
    expect(lines.has(LINE_ADDED)).toBe(true);
    expect(lines.has(LINE_CONTEXT)).toBe(true);
    expect(lines.has(LINE_GHOST)).toBe(false);
  });
});

describe("anchorNotes", () => {
  const files = [fileOf("src/a.ts", RAW)];

  test("keeps a note anchored to a real line", () => {
    expect(anchorNotes([note(LINE_ADDED)], files)).toEqual([note(LINE_ADDED)]);
  });

  test("drops a note whose line is not in the diff", () => {
    expect(anchorNotes([note(LINE_GHOST)], files)).toEqual([]);
  });

  test("drops a note whose file is not in the diff", () => {
    expect(anchorNotes([note(LINE_ADDED, { file: "ghost.ts" })], files)).toEqual([]);
  });
});

describe("renderNoteLine", () => {
  test("renders a single comment line and flattens newlines", () => {
    expect(renderNoteLine(note(LINE_ADDED, { body: "line one\nline two", kind: "nit" }))).toBe(
      "# 💬 [nit] line one line two",
    );
  });
});

describe("renderWithNotes", () => {
  test("inserts a note right after the added line it anchors to", () => {
    const rendered = renderWithNotes(RAW, [note(LINE_ADDED, { body: "off by one?" })]);
    const lines = rendered.split("\n");
    const added = lines.findIndex((row) => row.includes("+const a = 2;"));
    expect(lines[added + LINE_ADDED]).toBe("# 💬 [issue] off by one?");
  });

  test("anchors a note to a context line", () => {
    expect(renderWithNotes(RAW, [note(LINE_CONTEXT, { body: "why keep this?" })])).toContain(
      "# 💬 [issue] why keep this?",
    );
  });

  test("passes the diff through unchanged when there are no notes", () => {
    expect(renderWithNotes(RAW, [])).toBe(RAW);
  });

  test("keeps multiple notes on one line in their original order", () => {
    const rendered = renderWithNotes(RAW, [
      note(LINE_ADDED, { body: "first" }),
      note(LINE_ADDED, { body: "second" }),
    ]);
    expect(rendered.indexOf("first")).toBeLessThan(rendered.indexOf("second"));
  });
});
