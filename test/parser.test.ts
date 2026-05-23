import { FIRST, SECOND, SIMPLE_DIFF, TWO_FILE_DIFF } from "./helpers";
import {
  countChanges,
  parseGitHeader,
  parseSegmentMeta,
  splitDiffIntoFiles,
  stripPathToken,
} from "../src/parser/split";
import { describe, expect, test } from "bun:test";
import { parseUnifiedDiff } from "../src/parser";

const ONE_FILE = 1;
const TWO_FILES = 2;

describe("splitDiffIntoFiles", () => {
  test("returns [] for blank input", () => {
    expect(splitDiffIntoFiles("")).toEqual([]);
    expect(splitDiffIntoFiles("   \n  ")).toEqual([]);
  });

  test("splits a git diff on diff --git boundaries", () => {
    const segments = splitDiffIntoFiles(TWO_FILE_DIFF);
    expect(segments).toHaveLength(TWO_FILES);
    expect(segments[FIRST].startsWith("diff --git a/src/a.ts")).toBe(true);
    expect(segments[SECOND].startsWith("diff --git a/src/b.ts")).toBe(true);
    expect(segments[SECOND]).toContain("const b = 2;");
  });

  test("splits a non-git unified diff on --- / +++ pairs", () => {
    const raw = [
      "--- a.txt",
      "+++ a.txt",
      "@@ -1 +1 @@",
      "-x",
      "+y",
      "--- b.txt",
      "+++ b.txt",
      "@@ -1 +1 @@",
      "-p",
      "+q",
    ].join("\n");
    const segments = splitDiffIntoFiles(raw);
    expect(segments).toHaveLength(TWO_FILES);
    expect(segments[FIRST].startsWith("--- a.txt")).toBe(true);
    expect(segments[SECOND].startsWith("--- b.txt")).toBe(true);
  });

  test("does not treat a deletion line as a boundary", () => {
    const raw = ["--- a.txt", "+++ a.txt", "@@ -1,2 +1,1 @@", "--- not a header", " keep"].join(
      "\n",
    );
    expect(splitDiffIntoFiles(raw)).toHaveLength(ONE_FILE);
  });

  test("returns the whole input when no boundary is found", () => {
    expect(splitDiffIntoFiles("just some text\nwith no diff")).toEqual([
      "just some text\nwith no diff",
    ]);
  });

  test("does not crash when a trailing '--- ' line has no following line", () => {
    const raw = ["--- a.txt", "+++ b.txt", "@@ -1 +1 @@", "-x", "+y", "--- dangling"].join("\n");
    const segments = splitDiffIntoFiles(raw);
    expect(segments).toHaveLength(ONE_FILE);
    expect(segments[FIRST]).toContain("--- dangling");
  });
});

describe("stripPathToken", () => {
  test("strips a/ and b/ prefixes", () => {
    expect(stripPathToken("a/src/x.ts")).toBe("src/x.ts");
    expect(stripPathToken("b/src/x.ts")).toBe("src/x.ts");
  });
  test("keeps /dev/null verbatim", () => {
    expect(stripPathToken("/dev/null")).toBe("/dev/null");
  });
  test("drops a trailing tab-delimited timestamp", () => {
    expect(stripPathToken("a/x.ts\t2026-01-01 00:00:00")).toBe("x.ts");
  });
  test("trims surrounding whitespace", () => {
    expect(stripPathToken("a/x.ts  ")).toBe("x.ts");
    expect(stripPathToken("  b/y.ts")).toBe("y.ts");
  });
  test("returns a bare path unchanged", () => {
    expect(stripPathToken("plain.ts")).toBe("plain.ts");
  });
});

describe("parseGitHeader", () => {
  test("extracts both paths", () => {
    expect(parseGitHeader("diff --git a/foo.ts b/foo.ts")).toEqual({
      from: "foo.ts",
      to: "foo.ts",
    });
  });
  test("returns undefined for a non-matching line", () => {
    expect(parseGitHeader("index 111..222")).toBeUndefined();
  });
});

describe("parseSegmentMeta", () => {
  test("reads from/to from --- and +++ lines", () => {
    const meta = parseSegmentMeta(SIMPLE_DIFF);
    expect(meta).toEqual({ binary: false, from: "src/a.ts", to: "src/a.ts" });
  });

  test("reads distinct from/to from a non-git segment (no diff --git fallback)", () => {
    const seg = ["--- a/old.ts", "+++ b/new.ts", "@@ -1 +1 @@", "-x", "+y"].join("\n");
    expect(parseSegmentMeta(seg)).toEqual({ binary: false, from: "old.ts", to: "new.ts" });
  });

  test("returns empty paths when there are no headers and no git line at all", () => {
    expect(parseSegmentMeta("just some text\nwithout any headers")).toEqual({
      binary: false,
      from: "",
      to: "",
    });
  });

  test('flags "Binary files" patches', () => {
    const seg = [
      "diff --git a/img.png b/img.png",
      "Binary files a/img.png and b/img.png differ",
    ].join("\n");
    expect(parseSegmentMeta(seg).binary).toBe(true);
  });

  test('flags "GIT binary patch" patches and falls back to the git header for paths', () => {
    const seg = ["diff --git a/img.png b/img.png", "GIT binary patch", "literal 10"].join("\n");
    const meta = parseSegmentMeta(seg);
    expect(meta.binary).toBe(true);
    expect(meta).toMatchObject({ from: "img.png", to: "img.png" });
  });

  test("leaves paths empty when neither headers nor a git line are parseable", () => {
    expect(parseSegmentMeta("diff --git nonsense")).toEqual({ binary: false, from: "", to: "" });
  });
});

describe("countChanges", () => {
  test("counts additions and deletions, ignoring +++/--- headers", () => {
    expect(countChanges(SIMPLE_DIFF)).toEqual({ additions: 1, deletions: 1 });
  });
  test("counts multiple changes", () => {
    const seg = ["+a", "+b", "-c", " d", "+++ ignored", "--- ignored"].join("\n");
    expect(countChanges(seg)).toEqual({ additions: 2, deletions: 1 });
  });
  test("counts only +/- content lines with no header lines present", () => {
    expect(countChanges("+x\n+y\n-z")).toEqual({ additions: 2, deletions: 1 });
    expect(countChanges("-a\n-b")).toEqual({ additions: 0, deletions: 2 });
  });
});

describe("parseUnifiedDiff", () => {
  test("throws DS_E001 on empty input", () => {
    expect(() => parseUnifiedDiff("")).toThrow("DS_E001");
  });

  test("treats whitespace-only input as empty (DS_E001, not DS_E002)", () => {
    expect(() => parseUnifiedDiff("   \n  ")).toThrow("DS_E001");
  });

  test("throws DS_E002 when no diff is recognized", () => {
    expect(() => parseUnifiedDiff("this is just prose, not a diff")).toThrow("DS_E002");
  });

  test("parses a single-file diff into structured metadata", () => {
    const files = parseUnifiedDiff(SIMPLE_DIFF);
    expect(files).toHaveLength(ONE_FILE);
    expect(files[FIRST]).toMatchObject({
      additions: 1,
      binary: false,
      deletions: 1,
      from: "src/a.ts",
      path: "src/a.ts",
      to: "src/a.ts",
    });
    expect(files[FIRST].rawText).toBe(SIMPLE_DIFF);
  });

  test("uses the from path for a deleted file", () => {
    const raw = [
      "diff --git a/gone.ts b/gone.ts",
      "--- a/gone.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-bye",
    ].join("\n");
    const files = parseUnifiedDiff(raw);
    expect(files[FIRST].path).toBe("gone.ts");
  });

  test("uses the to path for an added file", () => {
    const raw = [
      "diff --git a/new.ts b/new.ts",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1 @@",
      "+hi",
    ].join("\n");
    const files = parseUnifiedDiff(raw);
    expect(files[FIRST].path).toBe("new.ts");
  });

  test("parses a two-file diff", () => {
    const files = parseUnifiedDiff(TWO_FILE_DIFF);
    expect(files.map((file) => file.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
