import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "../src/cli/args";
import { renderDoctor, runDoctorChecks } from "../src/cli/doctor";
import { makeIo } from "./helpers";

describe("parseCliArgs", () => {
  test("defaults to the 'default' command with all flags off", () => {
    const parsed = parseCliArgs([]);
    expect(parsed.command).toBe("default");
    expect(parsed.flags).toEqual({
      help: false,
      version: false,
      json: false,
      jsonSchema: false,
      rawPrompt: false,
      dryRun: false,
      chaptersJson: undefined,
      model: undefined,
      maxTokens: undefined,
    });
  });

  test("reads a subcommand from the first positional", () => {
    expect(parseCliArgs(["doctor"]).command).toBe("doctor");
  });

  test("parses boolean and string flags", () => {
    const parsed = parseCliArgs([
      "analyze",
      "--json",
      "--json-schema",
      "--raw-prompt",
      "--dry-run",
      "--chapters-json",
      "ch.json",
      "--model",
      "claude-x",
      "--max-tokens",
      "512",
    ]);
    expect(parsed.command).toBe("analyze");
    expect(parsed.flags).toEqual({
      help: false,
      version: false,
      json: true,
      jsonSchema: true,
      rawPrompt: true,
      dryRun: true,
      chaptersJson: "ch.json",
      model: "claude-x",
      maxTokens: "512",
    });
  });

  test("supports -h and -v short flags", () => {
    expect(parseCliArgs(["-h"]).flags.help).toBe(true);
    expect(parseCliArgs(["-v"]).flags.version).toBe(true);
  });

  test("throws DS_E007 on an unknown flag", () => {
    expect(() => parseCliArgs(["--nonsense"])).toThrow("DS_E007");
  });
});

describe("doctor", () => {
  test("passes when key, parse-diff, and git are all healthy", async () => {
    const io = makeIo({ env: { ANTHROPIC_API_KEY: "sk-test" }, bunVersion: "1.2.3" });
    const { checks, code } = await runDoctorChecks(io);
    expect(code).toBe(0);
    expect(checks).toEqual([
      { name: "ANTHROPIC_API_KEY", ok: true, detail: "set" },
      { name: "Bun runtime", ok: true, detail: "1.2.3" },
      { name: "parse-diff", ok: true, detail: "working" },
      { name: "git", ok: true, detail: "/usr/bin/git" },
    ]);
  });

  test("fails when the API key is missing and git is absent", async () => {
    const io = makeIo({ env: {}, which: () => Promise.resolve(null) });
    const { checks, code } = await runDoctorChecks(io);
    expect(code).toBe(1);
    expect(checks[0]).toEqual({ name: "ANTHROPIC_API_KEY", ok: false, detail: "not set" });
    expect(checks[3]).toEqual({ name: "git", ok: false, detail: "not found in PATH" });
  });

  test("treats an empty-string API key as not set", async () => {
    const io = makeIo({ env: { ANTHROPIC_API_KEY: "" } });
    const { checks } = await runDoctorChecks(io);
    expect(checks[0].ok).toBe(false);
  });

  test("renderDoctor marks each check with ✓ or ✗", () => {
    const text = renderDoctor([
      { name: "good", ok: true, detail: "fine" },
      { name: "bad", ok: false, detail: "broken" },
    ]);
    expect(text).toBe("✓ good: fine\n✗ bad: broken\n");
  });
});
