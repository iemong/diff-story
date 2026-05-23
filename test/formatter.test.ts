import { describe, expect, test } from "bun:test";
import { formatFilesJson, formatJson, formatStory, renderBanner, wordWrap } from "../src/formatter";
import type { Chapter, DiffFile } from "../src/types";

function file(path: string, extra: Partial<DiffFile> = {}): DiffFile {
  return {
    from: path,
    to: path,
    path,
    additions: 2,
    deletions: 1,
    binary: false,
    rawText: `diff --git a/${path} b/${path}\n+x\n`,
    ...extra,
  };
}

describe("wordWrap", () => {
  test("returns [''] for empty/whitespace text", () => {
    expect(wordWrap("", 10)).toEqual([""]);
    expect(wordWrap("   ", 10)).toEqual([""]);
  });
  test("keeps a short phrase on one line", () => {
    expect(wordWrap("a b c", 10)).toEqual(["a b c"]);
  });
  test("wraps when the width is exceeded", () => {
    expect(wordWrap("alpha beta gamma", 11)).toEqual(["alpha beta", "gamma"]);
  });
  test("keeps words together when they fit exactly at the width boundary", () => {
    expect(wordWrap("alpha beta", 10)).toEqual(["alpha beta"]);
  });
  test("wraps when one character over the width boundary", () => {
    expect(wordWrap("alpha beta", 9)).toEqual(["alpha", "beta"]);
  });
});

describe("renderBanner", () => {
  test("renders the chapter number, title, and a single-line synopsis", () => {
    const banner = renderBanner(2, 3, {
      title: "API contract",
      synopsis: "Short note.",
      files: [],
    });
    expect(banner).toContain("📖 Chapter 2/3 — API contract");
    expect(banner).toContain("# Synopsis: Short note.");
    expect(banner.split("\n")[0].startsWith("# ═")).toBe(true);
  });

  test("indents wrapped synopsis continuation lines", () => {
    const longSynopsis = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
    const banner = renderBanner(1, 1, { title: "T", synopsis: longSynopsis, files: [] });
    const lines = banner.split("\n");
    const synopsisLines = lines.filter((line) => line.includes("word"));
    expect(synopsisLines.length).toBeGreaterThan(1);
    expect(synopsisLines[0].startsWith("# Synopsis: ")).toBe(true);
    expect(synopsisLines[1].startsWith("#           ")).toBe(true);
  });
});

describe("formatStory", () => {
  const files = [file("a.ts"), file("b.ts")];
  const chapters: Chapter[] = [
    { title: "First", synopsis: "one", files: ["a.ts"] },
    { title: "Second", synopsis: "two", files: ["b.ts"] },
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
    const story = formatStory(files, [{ title: "Ghosts", synopsis: "s", files: ["missing.ts"] }]);
    expect(story).toContain("Ghosts");
    expect(story).not.toContain("diff --git");
  });
});

describe("formatFilesJson", () => {
  test("wraps files under a files key", () => {
    const json = JSON.parse(formatFilesJson([file("a.ts")]));
    expect(json.files).toHaveLength(1);
    expect(json.files[0].path).toBe("a.ts");
  });
});

describe("formatJson", () => {
  const chapters: Chapter[] = [{ title: "T", synopsis: "S", files: ["a.ts"] }];

  test("renders chapters with per-file stats and no run stats", () => {
    const json = JSON.parse(formatJson(chapters, [file("a.ts")]));
    expect(json.chapters[0]).toMatchObject({ title: "T", synopsis: "S" });
    expect(json.chapters[0].files[0]).toEqual({
      path: "a.ts",
      additions: 2,
      deletions: 1,
      binary: false,
    });
    expect(json.stats).toBeUndefined();
  });

  test("defaults stats to zero for files missing from the diff", () => {
    const json = JSON.parse(formatJson(chapters, []));
    expect(json.chapters[0].files[0]).toEqual({
      path: "a.ts",
      additions: 0,
      deletions: 0,
      binary: false,
    });
  });
});
