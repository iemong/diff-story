import {
  CHAPTERS_SCHEMA,
  appendLeftovers,
  parseChaptersJson,
  parseReview,
  pruneUnknownFiles,
  reconcileChapters,
  reconcileReview,
  validateChapterArray,
} from "../src/chapters";
import { FIRST, SECOND } from "./helpers";
import { describe, expect, test } from "bun:test";
import type { DiffFile } from "../src/types";
import type { DiffStoryError } from "../src/errors";

const TWO = 2;

const file = (path: string): DiffFile => ({
  additions: 1,
  binary: false,
  deletions: 0,
  from: path,
  path,
  rawText: `diff --git a/${path} b/${path}\n+content`,
  to: path,
});

const whyOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return (error as DiffStoryError).why;
  }
  throw new Error("expected the call to throw");
};

describe("CHAPTERS_SCHEMA", () => {
  test("describes the chapters object the agent must produce", () => {
    expect(CHAPTERS_SCHEMA.required).toEqual(["chapters"]);
    expect(CHAPTERS_SCHEMA.properties.chapters.items.required).toEqual([
      "title",
      "synopsis",
      "files",
    ]);
  });

  test("documents optional risk and checklist properties", () => {
    const { properties } = CHAPTERS_SCHEMA.properties.chapters.items;
    expect(properties.risk.enum).toEqual(["high", "medium", "low"]);
    expect(properties.checklist.type).toBe("array");
  });
});

describe("validateChapterArray", () => {
  test("accepts a well-formed array", () => {
    expect(validateChapterArray([{ files: ["a"], synopsis: "S", title: "T" }])).toEqual([
      { files: ["a"], synopsis: "S", title: "T" },
    ]);
  });
  test("rejects a non-array", () => {
    expect(whyOf(() => validateChapterArray({}))).toContain("expected an array of chapters");
  });
  test("rejects a non-object entry", () => {
    expect(whyOf(() => validateChapterArray(["nope"]))).toContain("chapter 0 is not an object");
  });
  test("rejects a null entry", () => {
    expect(whyOf(() => validateChapterArray(JSON.parse("[null]")))).toContain(
      "chapter 0 is not an object",
    );
  });
  test("rejects a non-string title", () => {
    expect(whyOf(() => validateChapterArray([{ files: [], synopsis: "s", title: 1 }]))).toContain(
      '"title"',
    );
  });
  test("rejects a non-string synopsis", () => {
    expect(whyOf(() => validateChapterArray([{ files: [], synopsis: 1, title: "t" }]))).toContain(
      '"synopsis"',
    );
  });
  test("rejects a files field that is not an array of strings", () => {
    expect(
      whyOf(() => validateChapterArray([{ files: ["ok", true], synopsis: "s", title: "t" }])),
    ).toContain('"files"');
    expect(
      whyOf(() => validateChapterArray([{ files: "x", synopsis: "s", title: "t" }])),
    ).toContain('"files"');
  });

  test("accepts optional risk and checklist", () => {
    expect(
      validateChapterArray([
        { checklist: ["check auth"], files: ["a"], risk: "high", synopsis: "S", title: "T" },
      ]),
    ).toEqual([
      { checklist: ["check auth"], files: ["a"], risk: "high", synopsis: "S", title: "T" },
    ]);
  });

  test("rejects an unknown risk value", () => {
    expect(
      whyOf(() =>
        validateChapterArray([{ files: ["a"], risk: "critical", synopsis: "s", title: "t" }]),
      ),
    ).toContain('"risk"');
  });

  test("rejects a checklist that is not an array of strings", () => {
    expect(
      whyOf(() =>
        validateChapterArray([{ checklist: [true], files: ["a"], synopsis: "s", title: "t" }]),
      ),
    ).toContain('"checklist"');
  });
});

describe("parseChaptersJson", () => {
  test("accepts a bare array", () => {
    expect(parseChaptersJson('[{"title":"T","synopsis":"S","files":["a"]}]')).toEqual([
      { files: ["a"], synopsis: "S", title: "T" },
    ]);
  });
  test("accepts a { chapters: [...] } object", () => {
    expect(parseChaptersJson('{"chapters":[{"title":"T","synopsis":"S","files":["a"]}]}')).toEqual([
      { files: ["a"], synopsis: "S", title: "T" },
    ]);
  });
  test("throws DS_E011 on malformed JSON", () => {
    expect(() => parseChaptersJson("{ not json")).toThrow("DS_E011");
  });
  test("throws DS_E011 when neither array nor chapters object", () => {
    expect(() => parseChaptersJson('{"nope":1}')).toThrow("DS_E011");
  });
  test("throws DS_E011 for a non-array, non-object JSON value", () => {
    expect(() => parseChaptersJson("42")).toThrow("DS_E011");
  });
});

describe("parseReview", () => {
  const REVIEW =
    '{"chapters":[{"title":"T","synopsis":"S","files":["a"]}],' +
    '"notes":[{"file":"a","line":3,"kind":"issue","body":"hmm"}]}';

  test("parses chapters and notes from a review object", () => {
    const review = parseReview(REVIEW);
    expect(review.chapters).toEqual([{ files: ["a"], synopsis: "S", title: "T" }]);
    expect(review.notes).toEqual([{ body: "hmm", file: "a", kind: "issue", line: 3 }]);
  });

  test("a bare chapters array yields no notes", () => {
    expect(parseReview('[{"title":"T","synopsis":"S","files":["a"]}]').notes).toEqual([]);
  });

  test("rejects a non-array notes field", () => {
    expect(whyOf(() => parseReview('{"chapters":[],"notes":{}}'))).toContain('"notes"');
  });

  test("rejects a non-object note", () => {
    expect(whyOf(() => parseReview('{"chapters":[],"notes":["x"]}'))).toContain(
      "note 0 is not an object",
    );
  });

  test("rejects notes with a bad file, line, kind, or body", () => {
    expect(
      whyOf(() => parseReview('{"chapters":[],"notes":[{"line":1,"kind":"issue","body":"b"}]}')),
    ).toContain('"file"');
    expect(
      whyOf(() =>
        parseReview('{"chapters":[],"notes":[{"file":"a","line":1.5,"kind":"issue","body":"b"}]}'),
      ),
    ).toContain('"line"');
    expect(
      whyOf(() =>
        parseReview('{"chapters":[],"notes":[{"file":"a","line":1,"kind":"rant","body":"b"}]}'),
      ),
    ).toContain('"kind"');
    expect(
      whyOf(() => parseReview('{"chapters":[],"notes":[{"file":"a","line":1,"kind":"issue"}]}')),
    ).toContain('"body"');
  });
});

describe("reconcileReview", () => {
  const RAW = ["diff --git a/a b/a", "--- a/a", "+++ b/a", "@@ -0,0 +1 @@", "+added"].join("\n");

  test("reconciles chapters and drops notes that do not anchor", () => {
    const files: DiffFile[] = [{ ...file("a"), rawText: RAW }];
    const review = reconcileReview(
      {
        chapters: [{ files: ["a"], synopsis: "s", title: "c" }],
        notes: [
          { body: "kept", file: "a", kind: "issue", line: 1 },
          { body: "dropped", file: "ghost", kind: "nit", line: 1 },
        ],
      },
      files,
    );
    expect(review.chapters[FIRST].files).toEqual(["a"]);
    expect(review.notes).toEqual([{ body: "kept", file: "a", kind: "issue", line: 1 }]);
  });
});

describe("pruneUnknownFiles", () => {
  test("drops unknown paths and empties", () => {
    const files = [file("a"), file("b")];
    const chapters = [
      { files: ["a", "ghost"], synopsis: "s", title: "c1" },
      { files: ["ghost"], synopsis: "s", title: "c2" },
    ];
    expect(pruneUnknownFiles(chapters, files)).toEqual([
      { files: ["a"], synopsis: "s", title: "c1" },
    ]);
  });
});

describe("appendLeftovers", () => {
  test("adds an appendix for unreferenced files", () => {
    const files = [file("a"), file("b")];
    const result = appendLeftovers([{ files: ["a"], synopsis: "s", title: "c1" }], files);
    expect(result).toHaveLength(TWO);
    expect(result[SECOND].title).toContain("Appendix");
    expect(result[SECOND].files).toEqual(["b"]);
  });
  test("returns the chapters unchanged when nothing is left over", () => {
    const files = [file("a")];
    const chapters = [{ files: ["a"], synopsis: "s", title: "c1" }];
    expect(appendLeftovers(chapters, files)).toBe(chapters);
  });
});

describe("reconcileChapters", () => {
  test("prunes unknowns then appends leftovers", () => {
    const files = [file("a"), file("b")];
    const result = reconcileChapters(
      [{ files: ["a", "ghost"], synopsis: "s", title: "c1" }],
      files,
    );
    expect(result[FIRST]).toEqual({ files: ["a"], synopsis: "s", title: "c1" });
    expect(result[SECOND].files).toEqual(["b"]);
  });
});
