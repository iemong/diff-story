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
      chapters: undefined,
      chaptersJson: undefined,
    });
  });

  test("reads a subcommand from the first positional", () => {
    expect(parseCliArgs(["doctor"]).command).toBe("doctor");
  });

  test("parses boolean and string flags", () => {
    const parsed = parseCliArgs([
      "format",
      "--json",
      "--json-schema",
      "--chapters",
      '{"chapters":[]}',
      "--chapters-json",
      "ch.json",
    ]);
    expect(parsed.command).toBe("format");
    expect(parsed.flags).toEqual({
      help: false,
      version: false,
      json: true,
      jsonSchema: true,
      chapters: '{"chapters":[]}',
      chaptersJson: "ch.json",
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
  test("passes when parse-diff and git are healthy", async () => {
    const io = makeIo({ bunVersion: "1.2.3" });
    const { checks, code } = await runDoctorChecks(io);
    expect(code).toBe(0);
    expect(checks).toEqual([
      { name: "Bun runtime", ok: true, detail: "1.2.3" },
      { name: "parse-diff", ok: true, detail: "working" },
      { name: "git", ok: true, detail: "/usr/bin/git" },
    ]);
  });

  test("fails when git is absent", async () => {
    const io = makeIo({ which: () => Promise.resolve(null) });
    const { checks, code } = await runDoctorChecks(io);
    expect(code).toBe(1);
    expect(checks[2]).toEqual({ name: "git", ok: false, detail: "not found in PATH" });
  });

  test("renderDoctor marks each check with ✓ or ✗", () => {
    const text = renderDoctor([
      { name: "good", ok: true, detail: "fine" },
      { name: "bad", ok: false, detail: "broken" },
    ]);
    expect(text).toBe("✓ good: fine\n✗ bad: broken\n");
  });
});
