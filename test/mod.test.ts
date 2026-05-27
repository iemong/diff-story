import {
  CHAPTERS_SCHEMA,
  DiffStoryError,
  Errors,
  VERSION,
  anchorNotes,
  buildManifest,
  buildPlan,
  classifyNoise,
  effectiveRisk,
  formatFilesJson,
  formatJson,
  formatStory,
  orderByRisk,
  parseChaptersJson,
  parseReview,
  parseUnifiedDiff,
  reconcileChapters,
  reconcileReview,
} from "../src/mod";
import { describe, expect, test } from "bun:test";

describe("public API (src/mod.ts)", () => {
  test("re-exports the composable primitives as functions", () => {
    for (const fn of [
      parseUnifiedDiff,
      buildPlan,
      buildManifest,
      parseChaptersJson,
      reconcileChapters,
      parseReview,
      reconcileReview,
      anchorNotes,
      classifyNoise,
      effectiveRisk,
      orderByRisk,
      formatStory,
      formatJson,
      formatFilesJson,
    ]) {
      expect(typeof fn).toBe("function");
    }
  });

  test("re-exports errors, schema, and version", () => {
    expect(Errors.emptyInput()).toBeInstanceOf(DiffStoryError);
    expect(CHAPTERS_SCHEMA.required).toEqual(["chapters"]);
    expect(VERSION).toBe("0.1.0");
  });

  test("is runtime-agnostic: parse → reconcile → format with no IO shell or model", () => {
    const files = parseUnifiedDiff(
      ["diff --git a/x.ts b/x.ts", "--- a/x.ts", "+++ b/x.ts", "@@ -1 +1 @@", "-a", "+b"].join(
        "\n",
      ),
    );
    const chapters = reconcileChapters(
      parseChaptersJson('{"chapters":[{"title":"Solo","synopsis":"one change","files":["x.ts"]}]}'),
      files,
    );
    const story = formatStory(files, chapters);
    expect(story).toContain("Chapter 1/1 — Solo");
    expect(story).toContain("diff --git a/x.ts b/x.ts");
  });
});
