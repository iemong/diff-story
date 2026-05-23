import type { AnalysisResult, DiffFile, LlmClient } from "../types";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { parseChapterResponse } from "./response";

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_MAX_TOKENS = 2048;

export interface AnalyzeOptions {
  llm: LlmClient;
  model?: string;
  maxTokens?: number;
  now?: () => number;
}

/** Ask the model to group a diff's files into an ordered story of chapters. */
export async function analyzeChapters(
  files: DiffFile[],
  options: AnalyzeOptions,
): Promise<AnalysisResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const now = options.now ?? Date.now;

  const start = now();
  const response = await options.llm.complete({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(files),
    model,
    maxTokens,
  });
  const chapters = parseChapterResponse(response.text, files);
  const durationMs = now() - start;

  return {
    chapters,
    stats: {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      durationMs,
      model,
    },
  };
}
