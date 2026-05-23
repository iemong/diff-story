import { describe, expect, test } from "bun:test";
import {
  analyzeChapters,
  createAnthropicClient,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DiffStoryError,
  Errors,
  formatFilesJson,
  formatJson,
  formatSchema,
  formatStory,
  OUTPUT_JSON_SCHEMA,
  parseUnifiedDiff,
  VERSION,
} from "../src/mod";

describe("public API (src/mod.ts)", () => {
  test("re-exports the composable primitives as functions", () => {
    for (const fn of [
      parseUnifiedDiff,
      analyzeChapters,
      createAnthropicClient,
      formatStory,
      formatJson,
      formatFilesJson,
      formatSchema,
    ]) {
      expect(typeof fn).toBe("function");
    }
  });

  test("re-exports errors, schema, defaults, and version", () => {
    expect(typeof Errors.emptyInput).toBe("function");
    expect(Errors.emptyInput()).toBeInstanceOf(DiffStoryError);
    expect(OUTPUT_JSON_SCHEMA.title).toBe("diff-story output");
    expect(DEFAULT_MODEL).toBe("claude-sonnet-4-6");
    expect(DEFAULT_MAX_TOKENS).toBeGreaterThan(0);
    expect(VERSION).toBe("0.1.0");
  });

  test("is runtime-agnostic: composes end to end without any IO shell", () => {
    const files = parseUnifiedDiff(
      ["diff --git a/x.ts b/x.ts", "--- a/x.ts", "+++ b/x.ts", "@@ -1 +1 @@", "-a", "+b"].join(
        "\n",
      ),
    );
    const story = formatStory(files, [{ title: "Solo", synopsis: "one change", files: ["x.ts"] }]);
    expect(story).toContain("Chapter 1/1 — Solo");
    expect(story).toContain("diff --git a/x.ts b/x.ts");
  });
});
