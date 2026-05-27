/**
 * Diff-story — reorder a unified diff into a narrative of chapters.
 *
 * A deterministic, runtime-agnostic library (no Bun/Node/Deno globals, no model
 * client). diff-story does not call an LLM itself: the agent driving it supplies
 * the chapter grouping. Compose the primitives directly:
 *
 * ```ts
 * import {
 *   parseUnifiedDiff,
 *   buildPlan,
 *   parseChaptersJson,
 *   reconcileChapters,
 *   formatStory,
 * } from "@iemong/diff-story";
 *
 * const files = parseUnifiedDiff(rawDiff);
 * const plan = buildPlan(files); // hand this to your agent
 * // ...agent returns chapters JSON...
 * const chapters = reconcileChapters(parseChaptersJson(agentJson), files);
 * const story = formatStory(files, chapters);
 * ```
 *
 * The command-line interface (which wires real stdin/stdout) lives outside this
 * module in `bin/` and `src/io.ts`.
 *
 * @module
 */

export { parseUnifiedDiff } from "./parser";

export { buildManifest, buildPlan, CHAPTERS_SHAPE } from "./plan";

export {
  appendLeftovers,
  CHAPTERS_SCHEMA,
  parseChaptersJson,
  parseReview,
  pruneUnknownFiles,
  reconcileChapters,
  reconcileReview,
  validateChapterArray,
} from "./chapters";

export { type StoryOptions, formatFilesJson, formatJson, formatStory } from "./formatter";

export { classifyNoise, type NoiseKind } from "./noise";

export { anchorNotes, anchorableLines, renderWithNotes } from "./notes";

export { effectiveRisk, orderByRisk } from "./risk";

export { DiffStoryError, type ErrorInfo, Errors } from "./errors";

export type { Chapter, DiffFile, Note, NoteKind, Review, Risk } from "./types";

export { VERSION } from "./version";
