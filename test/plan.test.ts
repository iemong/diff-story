import { CHAPTERS_SHAPE, buildManifest, buildPlan } from "../src/plan";
import { describe, expect, test } from "bun:test";
import type { DiffFile } from "../src/types";

const file = (path: string, extra: Partial<DiffFile> = {}): DiffFile => ({
  additions: 3,
  binary: false,
  deletions: 1,
  from: path,
  path,
  rawText: `diff --git a/${path} b/${path}\n+x`,
  to: path,
  ...extra,
});

describe("buildManifest", () => {
  test("numbers each file with its +/- counts", () => {
    const manifest = buildManifest([
      file("src/a.ts"),
      file("img.png", { additions: 0, binary: true, deletions: 0 }),
    ]);
    expect(manifest).toBe("1. src/a.ts (+3 -1)\n2. img.png (+0 -0, binary)");
  });
});

describe("buildPlan", () => {
  const plan = buildPlan([file("src/a.ts"), file("src/b.ts")]);

  test("states the file count and the format command to call back", () => {
    expect(plan).toContain("Group the 2 changed files");
    expect(plan).toContain("diff-story format --chapters '<json>'");
  });

  test("shows the chapters JSON shape and lists the files", () => {
    expect(plan).toContain(CHAPTERS_SHAPE);
    expect(plan).toContain("1. src/a.ts");
    expect(plan).toContain("2. src/b.ts");
  });

  test("does not mention any model, API key, or token budget", () => {
    expect(plan.toLowerCase()).not.toContain("anthropic");
    expect(plan.toLowerCase()).not.toContain("api key");
    expect(plan.toLowerCase()).not.toContain("token");
  });
});
