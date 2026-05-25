import { SIMPLE_DIFF, makeIo, whichMissing } from "./helpers";
import { buildAutoPrompt, detectAgent, extractJsonText, parseAgentOverride } from "../src/agent";
import { describe, expect, test } from "bun:test";
import { parseUnifiedDiff } from "../src/parser";

const CHAPTERS_OBJ = '{"chapters":[{"title":"t","synopsis":"s","files":["src/a.ts"]}]}';
const ONLY_CODEX: Record<string, string> = { codex: "/opt/homebrew/bin/codex" };

describe("agent — detectAgent", () => {
  test("returns the first known agent on PATH", async () => {
    const spec = await detectAgent(makeIo());
    expect(spec.command).toBe("claude");
    expect(spec.args).toEqual(["-p"]);
  });

  test("falls through to the next known agent when the first is absent", async () => {
    const io = makeIo({ which: (command: string) => Promise.resolve(ONLY_CODEX[command]) });
    const spec = await detectAgent(io);
    expect(spec.command).toBe("codex");
  });

  test("throws DS_E020 when no known agent is on PATH", async () => {
    await expect(detectAgent(makeIo({ which: whichMissing }))).rejects.toThrow("DS_E020");
  });

  test("an explicit override wins over detection", async () => {
    const spec = await detectAgent(makeIo({ which: whichMissing }), "mytool --flag");
    expect(spec).toEqual({ args: ["--flag"], command: "mytool" });
  });
});

describe("agent — parseAgentOverride", () => {
  test("splits a command with arguments", () => {
    expect(parseAgentOverride("claude -p")).toEqual({ args: ["-p"], command: "claude" });
  });

  test("a bare command has no arguments", () => {
    expect(parseAgentOverride("llm")).toEqual({ args: [], command: "llm" });
  });
});

describe("agent — buildAutoPrompt", () => {
  test("includes the JSON shape, the manifest, and the raw diff", () => {
    const prompt = buildAutoPrompt(parseUnifiedDiff(SIMPLE_DIFF), SIMPLE_DIFF);
    expect(prompt).toContain('"chapters"');
    expect(prompt).toContain("1. src/a.ts");
    expect(prompt).toContain("diff --git a/src/a.ts");
    expect(prompt).toContain("ONLY a JSON object");
  });
});

describe("agent — extractJsonText", () => {
  test("returns a bare JSON object unchanged", () => {
    expect(extractJsonText(CHAPTERS_OBJ)).toBe(CHAPTERS_OBJ);
  });

  test("unwraps a ```json fenced block", () => {
    expect(extractJsonText(`Here:\n\`\`\`json\n${CHAPTERS_OBJ}\n\`\`\`\nDone`)).toBe(CHAPTERS_OBJ);
  });

  test("unwraps a plain fenced block", () => {
    expect(extractJsonText(`\`\`\`\n${CHAPTERS_OBJ}\n\`\`\``)).toBe(CHAPTERS_OBJ);
  });

  test("slices JSON out of surrounding prose", () => {
    expect(extractJsonText(`Sure! ${CHAPTERS_OBJ} hope that helps.`)).toBe(CHAPTERS_OBJ);
  });

  test("prefers a bracket opener when it comes first", () => {
    expect(extractJsonText("x [1,2] y")).toBe("[1,2]");
  });

  test("keeps a brace opener when it comes before a bracket", () => {
    expect(extractJsonText("{a} [b]")).toBe("{a}");
  });

  test("stops at the balancing delimiter, ignoring prose (with braces) after it", () => {
    expect(extractJsonText(`${CHAPTERS_OBJ} Hope this helps {really}!`)).toBe(CHAPTERS_OBJ);
  });

  test("ignores delimiters that live inside JSON string literals", () => {
    const tricky = '{"title":"a } b","files":["x"]}';
    expect(extractJsonText(`prefix ${tricky} suffix`)).toBe(tricky);
  });

  test("handles nested objects", () => {
    const nested = '{"a":{"b":1},"c":2}';
    expect(extractJsonText(nested)).toBe(nested);
  });

  test("treats an escaped quote inside a string as a literal", () => {
    const escaped = String.raw`{"title":"say \"hi\"","files":[]}`;
    expect(extractJsonText(`note: ${escaped}`)).toBe(escaped);
  });

  test("treats an escaped backslash as a literal", () => {
    const slashes = String.raw`{"path":"a\\b"}`;
    expect(extractJsonText(slashes)).toBe(slashes);
  });

  test("returns trimmed text when there is no JSON opener", () => {
    expect(extractJsonText("  no json here  ")).toBe("no json here");
  });

  test("returns the remainder when the JSON never balances (truncated reply)", () => {
    expect(extractJsonText('{"chapters":[')).toBe('{"chapters":[');
  });
});
