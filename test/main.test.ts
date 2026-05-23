import { describe, expect, test } from "bun:test";
import { main } from "../src/main";
import { makeIo, SIMPLE_DIFF, TWO_FILE_DIFF } from "./helpers";

const CHAPTERS =
  '{"chapters":[{"title":"Setup","synopsis":"Lays groundwork.","files":["src/a.ts","src/b.ts"]}]}';

describe("main — help, version, schema", () => {
  test("--help prints usage", async () => {
    const io = makeIo();
    expect(await main(["--help"], io)).toBe(0);
    expect(io.out).toContain("read your diff like a book");
  });

  test("help subcommand prints usage", async () => {
    const io = makeIo();
    expect(await main(["help"], io)).toBe(0);
    expect(io.out).toContain("PROTOCOL");
  });

  test("--version prints the version", async () => {
    const io = makeIo();
    expect(await main(["--version"], io)).toBe(0);
    expect(io.out.trim()).toBe("0.1.0");
  });

  test("--json-schema prints the chapters schema without reading stdin", async () => {
    const io = makeIo({ stdin: () => Promise.reject(new Error("stdin should not be read")) });
    expect(await main(["--json-schema"], io)).toBe(0);
    expect(JSON.parse(io.out).title).toBe("diff-story chapters");
  });
});

describe("main — plan (default)", () => {
  test("emits the plan with the manifest and the format command", async () => {
    const io = makeIo({ stdin: TWO_FILE_DIFF });
    expect(await main([], io)).toBe(0);
    expect(io.out).toContain("Group the 2 changed files");
    expect(io.out).toContain("diff-story format --chapters");
    expect(io.out).toContain("1. src/a.ts");
  });

  test("plan subcommand behaves like the default", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main(["plan"], io)).toBe(0);
    expect(io.out).toContain("Group the 1 changed files");
  });

  test("needs no API key or model — works with an empty environment", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main([], io)).toBe(0);
    expect(io.out).not.toContain("ANTHROPIC");
  });
});

describe("main — parse", () => {
  test("prints files as JSON", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main(["parse"], io)).toBe(0);
    expect(JSON.parse(io.out).files[0].path).toBe("src/a.ts");
  });
});

describe("main — format", () => {
  test("renders the story from inline --chapters", async () => {
    const io = makeIo({ stdin: TWO_FILE_DIFF });
    expect(await main(["format", "--chapters", CHAPTERS], io)).toBe(0);
    expect(io.out).toContain("📖 Chapter 1/1 — Setup");
    expect(io.out).toContain("diff --git a/src/a.ts");
  });

  test("renders the story from --chapters-json file", async () => {
    const io = makeIo({
      stdin: TWO_FILE_DIFF,
      files: { "ch.json": '[{"title":"Ordered","synopsis":"s","files":["src/b.ts","src/a.ts"]}]' },
    });
    expect(await main(["format", "--chapters-json", "ch.json"], io)).toBe(0);
    expect(io.out).toContain("Chapter 1/1 — Ordered");
    expect(io.out.indexOf("src/b.ts")).toBeLessThan(io.out.indexOf("src/a.ts"));
  });

  test("--json emits enriched JSON without run stats", async () => {
    const io = makeIo({ stdin: TWO_FILE_DIFF });
    expect(await main(["format", "--json", "--chapters", CHAPTERS], io)).toBe(0);
    const parsed = JSON.parse(io.out);
    expect(parsed.chapters[0].title).toBe("Setup");
    expect(parsed.chapters[0].files[0]).toMatchObject({ path: "src/a.ts" });
    expect(parsed.stats).toBeUndefined();
  });

  test("inline --chapters takes precedence over --chapters-json", async () => {
    const io = makeIo({
      stdin: SIMPLE_DIFF,
      files: { "ch.json": '[{"title":"FromFile","synopsis":"s","files":["src/a.ts"]}]' },
    });
    await main(
      [
        "format",
        "--chapters",
        '[{"title":"Inline","synopsis":"s","files":["src/a.ts"]}]',
        "--chapters-json",
        "ch.json",
      ],
      io,
    );
    expect(io.out).toContain("Inline");
    expect(io.out).not.toContain("FromFile");
  });

  test("appends unreferenced files as an appendix", async () => {
    const io = makeIo({ stdin: TWO_FILE_DIFF });
    await main(["format", "--chapters", '[{"title":"A","synopsis":"s","files":["src/a.ts"]}]'], io);
    expect(io.out).toContain("Appendix");
    expect(io.out).toContain("src/b.ts");
  });
});

describe("main — doctor", () => {
  test("prints checks and returns 0 when healthy", async () => {
    const io = makeIo();
    expect(await main(["doctor"], io)).toBe(0);
    expect(io.out).toContain("✓ parse-diff: working");
    expect(io.out).toContain("✓ git:");
  });

  test("returns 1 when a check fails", async () => {
    const io = makeIo({ which: () => Promise.resolve(null) });
    expect(await main(["doctor"], io)).toBe(1);
    expect(io.out).toContain("✗ git: not found in PATH");
  });
});

describe("main — errors", () => {
  test("empty stdin yields DS_E001 (typed, not downgraded to DS_E999)", async () => {
    const io = makeIo({ stdin: "" });
    expect(await main(["parse"], io)).toBe(1);
    expect(io.err).toContain("(DS_E001)");
    expect(io.err).not.toContain("(DS_E999)");
  });

  test("non-diff input yields DS_E002", async () => {
    const io = makeIo({ stdin: "just prose, not a diff" });
    expect(await main([], io)).toBe(1);
    expect(io.err).toContain("DS_E002");
  });

  test("format without chapters yields DS_E009", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main(["format"], io)).toBe(1);
    expect(io.err).toContain("DS_E009");
  });

  test("an unreadable chapters file yields DS_E010", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, files: {} });
    expect(await main(["format", "--chapters-json", "missing.json"], io)).toBe(1);
    expect(io.err).toContain("DS_E010");
  });

  test("invalid inline chapters JSON yields DS_E011", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main(["format", "--chapters", "{ not json"], io)).toBe(1);
    expect(io.err).toContain("DS_E011");
  });

  test("structurally invalid chapters JSON yields DS_E011", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main(["format", "--chapters", '[{"title":1}]'], io)).toBe(1);
    expect(io.err).toContain("DS_E011");
  });

  test("an unknown command yields DS_E008", async () => {
    const io = makeIo();
    expect(await main(["frobnicate"], io)).toBe(1);
    expect(io.err).toContain("DS_E008");
  });

  test("an unknown flag yields DS_E007", async () => {
    const io = makeIo();
    expect(await main(["--nope"], io)).toBe(1);
    expect(io.err).toContain("DS_E007");
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
