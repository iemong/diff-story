import { EXIT_FAIL, EXIT_OK, makeIo, whichMissing } from "./helpers";
import { describe, expect, test } from "bun:test";
import { renderDoctor, runDoctorChecks } from "../src/cli/doctor";
import { parseCliArgs } from "../src/cli/args";

const GIT_CHECK = 2;

describe("parseCliArgs", () => {
  test("defaults to the 'default' command with all flags off", () => {
    const parsed = parseCliArgs([]);
    expect(parsed.command).toBe("default");
    expect(parsed.flags).toEqual({
      chapters: undefined,
      chaptersJson: undefined,
      fold: false,
      help: false,
      json: false,
      jsonSchema: false,
      order: "narrative",
      version: false,
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
      chapters: '{"chapters":[]}',
      chaptersJson: "ch.json",
      fold: false,
      help: false,
      json: true,
      jsonSchema: true,
      order: "narrative",
      version: false,
    });
  });

  test("supports -h and -v short flags", () => {
    expect(parseCliArgs(["-h"]).flags.help).toBe(true);
    expect(parseCliArgs(["-v"]).flags.version).toBe(true);
  });

  test("accepts --order risk", () => {
    expect(parseCliArgs(["auto", "--order", "risk"]).flags.order).toBe("risk");
  });

  test("accepts --order narrative explicitly", () => {
    expect(parseCliArgs(["auto", "--order", "narrative"]).flags.order).toBe("narrative");
  });

  test("throws DS_E007 on an unknown --order value", () => {
    expect(() => parseCliArgs(["auto", "--order", "wat"])).toThrow("DS_E007");
  });

  test("throws DS_E007 on an unknown flag", () => {
    expect(() => parseCliArgs(["--nonsense"])).toThrow("DS_E007");
  });
});

describe("doctor", () => {
  test("passes when parse-diff and git are healthy", async () => {
    const io = makeIo({ bunVersion: "1.2.3" });
    const { checks, code } = await runDoctorChecks(io);
    expect(code).toBe(EXIT_OK);
    expect(checks).toEqual([
      { detail: "1.2.3", name: "Bun runtime", ok: true },
      { detail: "working", name: "parse-diff", ok: true },
      { detail: "/usr/bin/git", name: "git", ok: true },
    ]);
  });

  test("fails when git is absent", async () => {
    const io = makeIo({ which: whichMissing });
    const { checks, code } = await runDoctorChecks(io);
    expect(code).toBe(EXIT_FAIL);
    expect(checks[GIT_CHECK]).toEqual({ detail: "not found in PATH", name: "git", ok: false });
  });

  test("renderDoctor marks each check with ✓ or ✗", () => {
    const text = renderDoctor([
      { detail: "fine", name: "good", ok: true },
      { detail: "broken", name: "bad", ok: false },
    ]);
    expect(text).toBe("✓ good: fine\n✗ bad: broken\n");
  });
});
