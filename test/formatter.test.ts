import type { Chapter, DiffFile } from "../src/types";
import { FIRST, SECOND } from "./helpers";
import { describe, expect, test } from "bun:test";
import { formatFilesJson, formatJson, formatStory, renderBanner, wordWrap } from "../src/formatter";

const WIDTH = 10;
const WIDTH_WIDE = 11;
const WIDTH_NARROW = 9;
const CH_INDEX = 2;
const CH_TOTAL = 3;
const ONE = 1;
const WORD_COUNT = 20;

const file = (path: string, extra: Partial<DiffFile> = {}): DiffFile => ({
  additions: 2,
  binary: false,
  deletions: 1,
  from: path,
  path,
  rawText: `diff --git a/${path} b/${path}\n+x\n`,
  to: path,
  ...extra,
});

describe("wordWrap", () => {
  test("returns [''] for empty/whitespace text", () => {
    expect(wordWrap("", WIDTH)).toEqual([""]);
    expect(wordWrap("   ", WIDTH)).toEqual([""]);
  });
  test("keeps a short phrase on one line", () => {
    expect(wordWrap("a b c", WIDTH)).toEqual(["a b c"]);
  });
  test("wraps when the width is exceeded", () => {
    expect(wordWrap("alpha beta gamma", WIDTH_WIDE)).toEqual(["alpha beta", "gamma"]);
  });
  test("keeps words together when they fit exactly at the width boundary", () => {
    expect(wordWrap("alpha beta", WIDTH)).toEqual(["alpha beta"]);
  });
  test("wraps when one character over the width boundary", () => {
    expect(wordWrap("alpha beta", WIDTH_NARROW)).toEqual(["alpha", "beta"]);
  });
});

describe("renderBanner", () => {
  test("renders the chapter number, title, and a single-line synopsis", () => {
    const banner = renderBanner(CH_INDEX, CH_TOTAL, {
      files: [],
      synopsis: "Short note.",
      title: "API contract",
    });
    expect(banner).toContain("📖 Chapter 2/3 — API contract");
    expect(banner).toContain("# Synopsis: Short note.");
    expect(banner.split("\n")[FIRST].startsWith("# ═")).toBe(true);
  });

  test("indents wrapped synopsis continuation lines", () => {
    const longSynopsis = Array.from(
      { length: WORD_COUNT },
      (_unused, index) => `word${index}`,
    ).join(" ");
    const banner = renderBanner(ONE, ONE, { files: [], synopsis: longSynopsis, title: "T" });
    const lines = banner.split("\n");
    const synopsisLines = lines.filter((line) => line.includes("word"));
    expect(synopsisLines.length).toBeGreaterThan(ONE);
    expect(synopsisLines[FIRST].startsWith("# Synopsis: ")).toBe(true);
    expect(synopsisLines[SECOND].startsWith("#           ")).toBe(true);
  });
});

describe("formatStory", () => {
  const files = [file("a.ts"), file("b.ts")];
  const chapters: Chapter[] = [
    { files: ["a.ts"], synopsis: "one", title: "First" },
    { files: ["b.ts"], synopsis: "two", title: "Second" },
  ];

  test("emits a banner then the verbatim diff for each chapter", () => {
    const story = formatStory(files, chapters);
    expect(story.startsWith("# ═")).toBe(true);
    expect(story).toContain("Chapter 1/2 — First");
    expect(story).toContain("diff --git a/a.ts b/a.ts");
    expect(story).toContain("Chapter 2/2 — Second");
    expect(story.endsWith("\n")).toBe(true);
    expect(story.indexOf("First")).toBeLessThan(story.indexOf("Second"));
  });

  test("skips chapter files that are not present in the diff", () => {
    const story = formatStory(files, [{ files: ["missing.ts"], synopsis: "s", title: "Ghosts" }]);
    expect(story).toContain("Ghosts");
    expect(story).not.toContain("diff --git");
  });
});

describe("formatFilesJson", () => {
  test("wraps files under a files key", () => {
    const json = JSON.parse(formatFilesJson([file("a.ts")]));
    expect(json.files).toHaveLength(ONE);
    expect(json.files[FIRST].path).toBe("a.ts");
  });
});

describe("formatJson", () => {
  const chapters: Chapter[] = [{ files: ["a.ts"], synopsis: "S", title: "T" }];

  test("renders chapters with per-file stats and no run stats", () => {
    const json = JSON.parse(formatJson(chapters, [file("a.ts")]));
    expect(json.chapters[FIRST]).toMatchObject({ synopsis: "S", title: "T" });
    expect(json.chapters[FIRST].files[FIRST]).toEqual({
      additions: 2,
      binary: false,
      deletions: 1,
      path: "a.ts",
    });
    expect(json.stats).toBeUndefined();
  });

  test("defaults stats to zero for files missing from the diff", () => {
    const json = JSON.parse(formatJson(chapters, []));
    expect(json.chapters[FIRST].files[FIRST]).toEqual({
      additions: 0,
      binary: false,
      deletions: 0,
      path: "a.ts",
    });
  });
});
