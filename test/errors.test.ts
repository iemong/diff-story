import { DiffStoryError, Errors } from "../src/errors";
import { describe, expect, test } from "bun:test";

const EMPTY = 0;

describe("DiffStoryError", () => {
  test("carries code/what/why/how and a descriptive message", () => {
    const error = new DiffStoryError({
      code: "DS_TEST",
      how: "the fix",
      what: "what happened",
      why: "the reason",
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DiffStoryError");
    expect(error.code).toBe("DS_TEST");
    expect(error.what).toBe("what happened");
    expect(error.why).toBe("the reason");
    expect(error.how).toBe("the fix");
    expect(error.message).toBe("DS_TEST: what happened");
  });

  test("format renders a What/Why/How block with the code", () => {
    const error = Errors.invalidChaptersJson("bad shape");
    const text = error.format();
    expect(text).toContain("(DS_E011)");
    expect(text).toContain("What:");
    expect(text).toContain("Why:   bad shape");
    expect(text).toContain("How:");
    expect(text.startsWith("✗ ")).toBe(true);
  });
});

describe("Errors catalog", () => {
  const cases: [string, DiffStoryError][] = [
    ["DS_E001", Errors.emptyInput()],
    ["DS_E002", Errors.noDiffFound()],
    ["DS_E007", Errors.badArguments("x")],
    ["DS_E008", Errors.unknownCommand("nope")],
    ["DS_E009", Errors.missingChapters()],
    ["DS_E010", Errors.chaptersFileUnreadable("/p", "x")],
    ["DS_E011", Errors.invalidChaptersJson("x")],
    ["DS_E020", Errors.agentNotFound("claude, codex")],
    ["DS_E021", Errors.agentFailed("claude", "boom")],
    ["DS_E999", Errors.unexpected("x")],
  ];

  test.each(cases)("%s has a unique code and full triple", (code, error) => {
    expect(error.code).toBe(code);
    expect(error.what.length).toBeGreaterThan(EMPTY);
    expect(error.why.length).toBeGreaterThan(EMPTY);
    expect(error.how.length).toBeGreaterThan(EMPTY);
  });

  test("all codes are unique", () => {
    const codes = cases.map(([code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("chaptersFileUnreadable and unknownCommand embed their arguments", () => {
    expect(Errors.chaptersFileUnreadable("/tmp/x.json", "boom").what).toContain("/tmp/x.json");
    expect(Errors.unknownCommand("frobnicate").what).toContain("frobnicate");
  });

  test("agent errors embed the command and the attempted list", () => {
    expect(Errors.agentFailed("claude", "boom").what).toContain("claude");
    expect(Errors.agentNotFound("claude, codex").why).toContain("codex");
  });
});
