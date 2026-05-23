/**
 * diff-story — reorder a unified diff into an AI-analyzed narrative of chapters.
 *
 * This is the portable, runtime-agnostic library surface (no Bun/Node/Deno
 * globals, no Anthropic SDK import). Compose the primitives directly:
 *
 * ```ts
 * import {
 *   parseUnifiedDiff,
 *   analyzeChapters,
 *   createAnthropicClient,
 *   formatStory,
 * } from "@iemong/diff-story";
 * import Anthropic from "@anthropic-ai/sdk";
 *
 * const files = parseUnifiedDiff(rawDiff);
 * const llm = createAnthropicClient(new Anthropic({ apiKey }));
 * const { chapters } = await analyzeChapters(files, { llm });
 * const story = formatStory(files, chapters);
 * ```
 *
 * The analysis stage is the only one that talks to a model, and it does so
 * behind {@link LlmClient}; everything else is pure. The command-line interface
 * (which wires real stdin/stdout and the Anthropic SDK) lives outside this
 * module in `bin/` and `src/io.ts`.
 *
 * @module
 */

export { parseUnifiedDiff } from "./parser";

export {
  analyzeChapters,
  type AnalyzeOptions,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
} from "./analyzer";
export { type AnthropicLike, createAnthropicClient } from "./analyzer/llm";

export {
  formatFilesJson,
  formatJson,
  formatSchema,
  formatStory,
  OUTPUT_JSON_SCHEMA,
} from "./formatter";

export { DiffStoryError, type ErrorInfo, Errors } from "./errors";

export type {
  AnalysisResult,
  AnalysisStats,
  Chapter,
  DiffFile,
  LlmClient,
  LlmRequest,
  LlmResponse,
} from "./types";

export { VERSION } from "./version";
