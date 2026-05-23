import { describe, expect, test } from "bun:test";
import { main } from "../src/main";
import { fakeLlm, makeIo, SIMPLE_DIFF, TWO_FILE_DIFF } from "./helpers";

const GOOD_RESPONSE =
  '{"chapters":[{"title":"Setup","synopsis":"Lays groundwork.","files":["src/a.ts","src/b.ts"]}]}';
const KEY_ENV = { ANTHROPIC_API_KEY: "sk-test" };

describe("main — help & version", () => {
  test("--help prints usage", async () => {
    const io = makeIo();
    expect(await main(["--help"], io)).toBe(0);
    expect(io.out).toContain("read your diff like a book");
  });

  test("help subcommand prints usage", async () => {
    const io = makeIo();
    expect(await main(["help"], io)).toBe(0);
    expect(io.out).toContain("USAGE");
  });

  test("--version prints the version", async () => {
    const io = makeIo();
    expect(await main(["--version"], io)).toBe(0);
    expect(io.out.trim()).toBe("0.1.0");
  });
});

describe("main — doctor", () => {
  test("prints checks and returns 0 when healthy", async () => {
    const io = makeIo({ env: KEY_ENV });
    expect(await main(["doctor"], io)).toBe(0);
    expect(io.out).toContain("✓ ANTHROPIC_API_KEY: set");
    expect(io.out).toContain("✓ git:");
  });

  test("returns 1 when a check fails", async () => {
    const io = makeIo({ env: {}, which: () => Promise.resolve(null) });
    expect(await main(["doctor"], io)).toBe(1);
    expect(io.out).toContain("✗ ANTHROPIC_API_KEY: not set");
  });
});

describe("main — default command", () => {
  test("analyzes the diff and prints an annotated story", async () => {
    const io = makeIo({
      stdin: TWO_FILE_DIFF,
      env: KEY_ENV,
      llm: fakeLlm({ text: GOOD_RESPONSE }),
    });
    expect(await main([], io)).toBe(0);
    expect(io.out).toContain("📖 Chapter 1/1 — Setup");
    expect(io.out).toContain("diff --git a/src/a.ts");
  });

  test("--json emits machine-readable JSON", async () => {
    const io = makeIo({
      stdin: TWO_FILE_DIFF,
      env: KEY_ENV,
      llm: fakeLlm({ text: GOOD_RESPONSE, inputTokens: 3, outputTokens: 4 }),
    });
    expect(await main(["--json"], io)).toBe(0);
    const parsed = JSON.parse(io.out);
    expect(parsed.chapters[0].title).toBe("Setup");
    expect(parsed.stats.inputTokens).toBe(3);
  });

  test("--json-schema prints the schema without reading stdin", async () => {
    const io = makeIo({
      stdin: () => Promise.reject(new Error("stdin should not be read")),
    });
    expect(await main(["--json-schema"], io)).toBe(0);
    expect(JSON.parse(io.out).title).toBe("diff-story output");
  });

  test("--raw-prompt prints the prompt and skips the model", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, env: {} });
    expect(await main(["--raw-prompt"], io)).toBe(0);
    expect(io.out).toContain("# SYSTEM");
    expect(io.out).toContain("# USER");
    expect(io.out).toContain("src/a.ts");
  });

  test("--dry-run emits one chapter with every file and no model call", async () => {
    const io = makeIo({ stdin: TWO_FILE_DIFF, env: {} });
    expect(await main(["--dry-run"], io)).toBe(0);
    expect(io.out).toContain("Chapter 1/1 — Full diff");
    expect(io.out).toContain("src/a.ts");
    expect(io.out).toContain("src/b.ts");
  });

  test("--chapters-json uses supplied chapters and skips the model", async () => {
    const chaptersFile = JSON.stringify({
      chapters: [{ title: "Manual", synopsis: "By hand.", files: ["src/a.ts"] }],
    });
    const io = makeIo({
      stdin: TWO_FILE_DIFF,
      env: {},
      files: { "ch.json": chaptersFile },
    });
    expect(await main(["--chapters-json", "ch.json"], io)).toBe(0);
    expect(io.out).toContain("Chapter 1/2 — Manual");
    expect(io.out).toContain("Appendix");
  });

  test("--chapters-json with --json renders manual chapters as JSON", async () => {
    const io = makeIo({
      stdin: SIMPLE_DIFF,
      files: { "ch.json": JSON.stringify([{ title: "M", synopsis: "s", files: ["src/a.ts"] }]) },
    });
    expect(await main(["--json", "--chapters-json", "ch.json"], io)).toBe(0);
    expect(JSON.parse(io.out).stats.model).toBe("chapters-json");
  });
});

describe("main — parse / analyze / format", () => {
  test("parse prints files as JSON without a key", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, env: {} });
    expect(await main(["parse"], io)).toBe(0);
    expect(JSON.parse(io.out).files[0].path).toBe("src/a.ts");
  });

  test("analyze prints chapters as JSON", async () => {
    const io = makeIo({
      stdin: TWO_FILE_DIFF,
      env: KEY_ENV,
      llm: fakeLlm({ text: GOOD_RESPONSE }),
    });
    expect(await main(["analyze"], io)).toBe(0);
    expect(JSON.parse(io.out).chapters[0].title).toBe("Setup");
  });

  test("format requires --chapters-json", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main(["format"], io)).toBe(1);
    expect(io.err).toContain("DS_E009");
  });

  test("format re-emits the diff with supplied chapters", async () => {
    const io = makeIo({
      stdin: TWO_FILE_DIFF,
      files: {
        "ch.json": JSON.stringify([
          { title: "Ordered", synopsis: "s", files: ["src/b.ts", "src/a.ts"] },
        ]),
      },
    });
    expect(await main(["format", "--chapters-json", "ch.json"], io)).toBe(0);
    expect(io.out).toContain("Chapter 1/1 — Ordered");
    expect(io.out.indexOf("src/b.ts")).toBeLessThan(io.out.indexOf("src/a.ts"));
  });
});

describe("main — model option resolution", () => {
  test("--model overrides the default", async () => {
    let model = "";
    const io = makeIo({
      stdin: SIMPLE_DIFF,
      env: KEY_ENV,
      llm: fakeLlm({ text: GOOD_RESPONSE, capture: (request) => (model = request.model) }),
    });
    await main(["--model", "claude-custom"], io);
    expect(model).toBe("claude-custom");
  });

  test("DIFF_STORY_MODEL is used when --model is absent", async () => {
    let model = "";
    const io = makeIo({
      stdin: SIMPLE_DIFF,
      env: { ...KEY_ENV, DIFF_STORY_MODEL: "claude-env" },
      llm: fakeLlm({ text: GOOD_RESPONSE, capture: (request) => (model = request.model) }),
    });
    await main([], io);
    expect(model).toBe("claude-env");
  });

  test("--max-tokens is forwarded to the model", async () => {
    let maxTokens = 0;
    const io = makeIo({
      stdin: SIMPLE_DIFF,
      env: KEY_ENV,
      llm: fakeLlm({ text: GOOD_RESPONSE, capture: (request) => (maxTokens = request.maxTokens) }),
    });
    await main(["--max-tokens", "256"], io);
    expect(maxTokens).toBe(256);
  });

  test("rejects a non-integer --max-tokens", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, env: KEY_ENV });
    expect(await main(["--max-tokens", "abc"], io)).toBe(1);
    expect(io.err).toContain("DS_E006");
  });

  test("rejects a zero --max-tokens", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, env: KEY_ENV });
    expect(await main(["--max-tokens", "0"], io)).toBe(1);
    expect(io.err).toContain("DS_E006");
  });
});

describe("main — error handling", () => {
  test("missing API key yields DS_E003", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, env: {} });
    expect(await main([], io)).toBe(1);
    expect(io.err).toContain("DS_E003");
  });

  test("an empty-string API key is treated as missing (DS_E003)", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, env: { ANTHROPIC_API_KEY: "" } });
    expect(await main([], io)).toBe(1);
    expect(io.err).toContain("DS_E003");
  });

  test("empty stdin yields DS_E001", async () => {
    const io = makeIo({ stdin: "", env: KEY_ENV });
    expect(await main(["parse"], io)).toBe(1);
    expect(io.err).toContain("DS_E001");
  });

  test("an invalid model response surfaces DS_E005 (not wrapped as DS_E004)", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, env: KEY_ENV, llm: fakeLlm({ text: "not json" }) });
    expect(await main(["analyze"], io)).toBe(1);
    expect(io.err).toContain("(DS_E005)");
    expect(io.err).not.toContain("(DS_E004)");
  });

  test("a model network failure surfaces DS_E004", async () => {
    const io = makeIo({
      stdin: SIMPLE_DIFF,
      env: KEY_ENV,
      llm: fakeLlm({ error: new Error("connection reset") }),
    });
    expect(await main([], io)).toBe(1);
    expect(io.err).toContain("DS_E004");
    expect(io.err).toContain("connection reset");
  });

  test("an unknown command yields DS_E008", async () => {
    const io = makeIo();
    expect(await main(["frobnicate"], io)).toBe(1);
    expect(io.err).toContain("DS_E008");
  });

  test("an unreadable chapters file yields DS_E010", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, files: {} });
    expect(await main(["format", "--chapters-json", "missing.json"], io)).toBe(1);
    expect(io.err).toContain("DS_E010");
  });

  test("invalid chapters JSON yields DS_E011", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, files: { "ch.json": "{ not json" } });
    expect(await main(["format", "--chapters-json", "ch.json"], io)).toBe(1);
    expect(io.err).toContain("DS_E011");
  });

  test("structurally invalid chapters JSON yields DS_E011", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, files: { "ch.json": '{"chapters":[{"title":1}]}' } });
    expect(await main(["format", "--chapters-json", "ch.json"], io)).toBe(1);
    expect(io.err).toContain("DS_E011");
  });

  test("an unexpected Error is wrapped as DS_E999", async () => {
    const io = makeIo({ stdin: () => Promise.reject(new Error("disk exploded")) });
    expect(await main(["parse"], io)).toBe(1);
    expect(io.err).toContain("DS_E999");
    expect(io.err).toContain("disk exploded");
  });

  test("an unexpected non-Error throw is stringified into DS_E999", async () => {
    const io = makeIo({ stdin: () => Promise.reject("just a string") });
    expect(await main(["parse"], io)).toBe(1);
    expect(io.err).toContain("DS_E999");
    expect(io.err).toContain("just a string");
  });
});
