import { describe, expect, test } from "bun:test";
import {
  appendLeftovers,
  CHAPTERS_SCHEMA,
  parseChaptersJson,
  pruneUnknownFiles,
  reconcileChapters,
  validateChapterArray,
} from "../src/chapters";
import { DiffStoryError } from "../src/errors";
import type { DiffFile } from "../src/types";

function file(path: string): DiffFile {
  return {
    from: path,
    to: path,
    path,
    additions: 1,
    deletions: 0,
    binary: false,
    rawText: `diff --git a/${path} b/${path}\n+content`,
  };
}

function whyOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as DiffStoryError).why;
  }
  throw new Error("expected the call to throw");
}

describe("CHAPTERS_SCHEMA", () => {
  test("describes the chapters object the agent must produce", () => {
    expect(CHAPTERS_SCHEMA.required).toEqual(["chapters"]);
    expect(CHAPTERS_SCHEMA.properties.chapters.items.required).toEqual([
      "title",
      "synopsis",
      "files",
    ]);
  });
});

describe("validateChapterArray", () => {
  test("accepts a well-formed array", () => {
    expect(validateChapterArray([{ title: "T", synopsis: "S", files: ["a"] }])).toEqual([
      { title: "T", synopsis: "S", files: ["a"] },
    ]);
  });
  test("rejects a non-array", () => {
    expect(whyOf(() => validateChapterArray({}))).toContain("expected an array of chapters");
  });
  test("rejects a non-object entry", () => {
    expect(whyOf(() => validateChapterArray(["nope"]))).toContain("chapter 0 is not an object");
  });
  test("rejects a null entry", () => {
    expect(whyOf(() => validateChapterArray([null]))).toContain("chapter 0 is not an object");
  });
  test("rejects a non-string title", () => {
    expect(whyOf(() => validateChapterArray([{ title: 1, synopsis: "s", files: [] }]))).toContain(
      '"title"',
    );
  });
  test("rejects a non-string synopsis", () => {
    expect(whyOf(() => validateChapterArray([{ title: "t", synopsis: 1, files: [] }]))).toContain(
      '"synopsis"',
    );
  });
  test("rejects a files field that is not an array of strings", () => {
    expect(
      whyOf(() => validateChapterArray([{ title: "t", synopsis: "s", files: ["ok", 1] }])),
    ).toContain('"files"');
    expect(
      whyOf(() => validateChapterArray([{ title: "t", synopsis: "s", files: "x" }])),
    ).toContain('"files"');
  });
});

describe("parseChaptersJson", () => {
  test("accepts a bare array", () => {
    expect(parseChaptersJson('[{"title":"T","synopsis":"S","files":["a"]}]')).toEqual([
      { title: "T", synopsis: "S", files: ["a"] },
    ]);
  });
  test("accepts a { chapters: [...] } object", () => {
    expect(parseChaptersJson('{"chapters":[{"title":"T","synopsis":"S","files":["a"]}]}')).toEqual([
      { title: "T", synopsis: "S", files: ["a"] },
    ]);
  });
  test("throws DS_E011 on malformed JSON", () => {
    expect(() => parseChaptersJson("{ not json")).toThrow("DS_E011");
  });
  test("throws DS_E011 when neither array nor chapters object", () => {
    expect(() => parseChaptersJson('{"nope":1}')).toThrow("DS_E011");
  });
});

describe("pruneUnknownFiles", () => {
  test("drops unknown paths and empties", () => {
    const files = [file("a"), file("b")];
    const chapters = [
      { title: "c1", synopsis: "s", files: ["a", "ghost"] },
      { title: "c2", synopsis: "s", files: ["ghost"] },
    ];
    expect(pruneUnknownFiles(chapters, files)).toEqual([
      { title: "c1", synopsis: "s", files: ["a"] },
    ]);
  });
});

describe("appendLeftovers", () => {
  test("adds an appendix for unreferenced files", () => {
    const files = [file("a"), file("b")];
    const result = appendLeftovers([{ title: "c1", synopsis: "s", files: ["a"] }], files);
    expect(result).toHaveLength(2);
    expect(result[1].title).toContain("Appendix");
    expect(result[1].files).toEqual(["b"]);
  });
  test("returns the chapters unchanged when nothing is left over", () => {
    const files = [file("a")];
    const chapters = [{ title: "c1", synopsis: "s", files: ["a"] }];
    expect(appendLeftovers(chapters, files)).toBe(chapters);
  });
});

describe("reconcileChapters", () => {
  test("prunes unknowns then appends leftovers", () => {
    const files = [file("a"), file("b")];
    const result = reconcileChapters(
      [{ title: "c1", synopsis: "s", files: ["a", "ghost"] }],
      files,
    );
    expect(result[0]).toEqual({ title: "c1", synopsis: "s", files: ["a"] });
    expect(result[1].files).toEqual(["b"]);
  });
});
