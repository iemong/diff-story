import { describe, expect, test } from "bun:test";
import { analyzeChapters, DEFAULT_MAX_TOKENS, DEFAULT_MODEL } from "../src/analyzer";
import { appendLeftovers, pruneUnknownFiles, validateChapterArray } from "../src/analyzer/chapters";
import { createAnthropicClient, type AnthropicLike } from "../src/analyzer/llm";
import {
  buildUserPrompt,
  MAX_DIFF_CHARS,
  SYSTEM_PROMPT,
  truncateDiff,
} from "../src/analyzer/prompt";
import { extractJson, parseChapterResponse } from "../src/analyzer/response";
import { DiffStoryError } from "../src/errors";
import type { DiffFile, LlmRequest } from "../src/types";
import { fakeLlm } from "./helpers";

function file(path: string, extra: Partial<DiffFile> = {}): DiffFile {
  return {
    from: path,
    to: path,
    path,
    additions: 1,
    deletions: 0,
    binary: false,
    rawText: `diff --git a/${path} b/${path}\n+content`,
    ...extra,
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

describe("chapters helpers", () => {
  describe("validateChapterArray", () => {
    test("accepts a well-formed array", () => {
      const result = validateChapterArray([{ title: "T", synopsis: "S", files: ["a"] }]);
      expect(result).toEqual([{ title: "T", synopsis: "S", files: ["a"] }]);
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
    test("rejects a files array with any non-string element", () => {
      expect(
        whyOf(() => validateChapterArray([{ title: "t", synopsis: "s", files: ["ok", 1] }])),
      ).toContain('"files"');
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
    test("rejects a non-string-array files field", () => {
      expect(
        whyOf(() => validateChapterArray([{ title: "t", synopsis: "s", files: [1] }])),
      ).toContain('"files"');
      expect(
        whyOf(() => validateChapterArray([{ title: "t", synopsis: "s", files: "x" }])),
      ).toContain('"files"');
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
});

describe("prompt", () => {
  test("SYSTEM_PROMPT mentions chapters", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("chapter");
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  describe("truncateDiff", () => {
    test("leaves short text untouched", () => {
      expect(truncateDiff("short", 100)).toBe("short");
    });
    test("truncates long text with a marker", () => {
      const out = truncateDiff("x".repeat(50), 10);
      expect(out.startsWith("x".repeat(10))).toBe(true);
      expect(out).toContain("truncated 40 chars");
    });
    test("uses MAX_DIFF_CHARS by default", () => {
      expect(truncateDiff("y".repeat(MAX_DIFF_CHARS + 5)).length).toBeLessThan(MAX_DIFF_CHARS + 60);
    });
  });

  describe("buildUserPrompt", () => {
    test("lists each file with stats and asks for JSON", () => {
      const prompt = buildUserPrompt([
        file("src/a.ts"),
        file("img.png", { binary: true, additions: 0 }),
      ]);
      expect(prompt).toContain("There are 2 changed files");
      expect(prompt).toContain("## File 1: src/a.ts (+1 -0)");
      expect(prompt).toContain("## File 2: img.png (+0 -0, binary)");
      expect(prompt).toContain('"chapters"');
    });
  });
});

describe("extractJson", () => {
  test("parses bare JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  test("parses fenced ```json blocks", () => {
    expect(extractJson('here:\n```json\n{"a":2}\n```\nthanks')).toEqual({ a: 2 });
  });
  test("slices a JSON object out of surrounding prose", () => {
    expect(extractJson('Sure! {"a":3} done')).toEqual({ a: 3 });
  });
  test("prefers the fenced block over braces elsewhere in the prose", () => {
    expect(extractJson('{ ignore this\n```json\n{"a":9}\n```')).toEqual({ a: 9 });
  });
  test("throws when there is no JSON at all", () => {
    expect(() => extractJson("no json here")).toThrow("DS_E005");
  });
  test("throws when the sliced span is still invalid", () => {
    expect(() => extractJson("prose { not json } more")).toThrow("DS_E005");
  });
});

describe("parseChapterResponse", () => {
  const files = [file("a"), file("b")];

  test("normalizes chapters and appends leftovers", () => {
    const text = '{"chapters":[{"title":"T","synopsis":"S","files":["a"]}]}';
    const chapters = parseChapterResponse(text, files);
    expect(chapters[0]).toEqual({ title: "T", synopsis: "S", files: ["a"] });
    expect(chapters[1].files).toEqual(["b"]);
  });

  test("throws DS_E005 when chapters is missing", () => {
    expect(() => parseChapterResponse('{"nope":[]}', files)).toThrow("DS_E005");
  });

  test("throws DS_E005 when the response is not an object", () => {
    expect(() => parseChapterResponse("[1,2,3]", files)).toThrow("DS_E005");
  });

  test("throws DS_E005 when the response is JSON null", () => {
    expect(() => parseChapterResponse("null", files)).toThrow("DS_E005");
  });

  test("throws DS_E005 when a chapter is malformed", () => {
    expect(() =>
      parseChapterResponse('{"chapters":[{"title":1,"synopsis":"s","files":[]}]}', files),
    ).toThrow("DS_E005");
  });
});

describe("createAnthropicClient", () => {
  test("maps a request through the SDK and concatenates text blocks", async () => {
    let received: unknown;
    const sdk: AnthropicLike = {
      messages: {
        create: (body) => {
          received = body;
          return Promise.resolve({
            content: [
              { type: "text", text: "hello " },
              { type: "thinking", text: "ignored" },
              { type: "text", text: "world" },
            ],
            usage: { input_tokens: 11, output_tokens: 22 },
          });
        },
      },
    };
    const client = createAnthropicClient(sdk);
    const request: LlmRequest = { system: "sys", user: "usr", model: "m", maxTokens: 7 };
    const response = await client.complete(request);

    expect(received).toEqual({
      model: "m",
      max_tokens: 7,
      system: "sys",
      messages: [{ role: "user", content: "usr" }],
    });
    expect(response).toEqual({ text: "hello world", inputTokens: 11, outputTokens: 22 });
  });

  test("defaults token counts to 0 and missing text to empty", async () => {
    const sdk: AnthropicLike = {
      messages: {
        create: () => Promise.resolve({ content: [{ type: "text" }] }),
      },
    };
    const response = await createAnthropicClient(sdk).complete({
      system: "s",
      user: "u",
      model: "m",
      maxTokens: 1,
    });
    expect(response).toEqual({ text: "", inputTokens: 0, outputTokens: 0 });
  });
});

describe("analyzeChapters", () => {
  const files = [file("a"), file("b")];
  const goodResponse = '{"chapters":[{"title":"T","synopsis":"S","files":["a","b"]}]}';

  test("returns chapters and stats from the model response", async () => {
    let captured: LlmRequest | undefined;
    const clock = (() => {
      let t = 100;
      return () => {
        t += 50;
        return t;
      };
    })();
    const result = await analyzeChapters(files, {
      llm: fakeLlm({
        text: goodResponse,
        inputTokens: 5,
        outputTokens: 8,
        capture: (request) => (captured = request),
      }),
      model: "custom-model",
      maxTokens: 99,
      now: clock,
    });

    expect(result.chapters[0].files).toEqual(["a", "b"]);
    expect(result.stats).toEqual({
      inputTokens: 5,
      outputTokens: 8,
      durationMs: 50,
      model: "custom-model",
    });
    expect(captured?.model).toBe("custom-model");
    expect(captured?.maxTokens).toBe(99);
  });

  test("applies default model, max tokens, and clock", async () => {
    let captured: LlmRequest | undefined;
    const result = await analyzeChapters(files, {
      llm: fakeLlm({ text: goodResponse, capture: (request) => (captured = request) }),
    });
    expect(captured?.model).toBe(DEFAULT_MODEL);
    expect(captured?.maxTokens).toBe(DEFAULT_MAX_TOKENS);
    expect(result.stats.model).toBe(DEFAULT_MODEL);
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
  });
});
