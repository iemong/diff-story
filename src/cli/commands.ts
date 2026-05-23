import {
  analyzeChapters,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  type AnalyzeOptions,
} from "../analyzer";
import { appendLeftovers, pruneUnknownFiles, validateChapterArray } from "../analyzer/chapters";
import { buildUserPrompt, SYSTEM_PROMPT } from "../analyzer/prompt";
import { DiffStoryError, Errors } from "../errors";
import { formatFilesJson, formatJson, formatSchema, formatStory } from "../formatter";
import { parseUnifiedDiff } from "../parser";
import type { AnalysisResult, Chapter, DiffFile, Io, LlmClient } from "../types";
import type { CliFlags } from "./args";

function getLlm(io: Io): LlmClient {
  const key = io.env.ANTHROPIC_API_KEY;
  if (key === undefined || key === "") {
    throw Errors.missingApiKey();
  }
  return io.createLlm(key);
}

function resolveModelOptions(
  flags: CliFlags,
  env: Record<string, string | undefined>,
): { model: string; maxTokens: number } {
  const model = flags.model ?? env.DIFF_STORY_MODEL ?? DEFAULT_MODEL;

  let maxTokens = DEFAULT_MAX_TOKENS;
  if (flags.maxTokens !== undefined) {
    const value = Number(flags.maxTokens);
    if (!Number.isInteger(value) || value <= 0) {
      throw Errors.invalidMaxTokens(flags.maxTokens);
    }
    maxTokens = value;
  }
  return { model, maxTokens };
}

async function runAnalysis(files: DiffFile[], options: AnalyzeOptions): Promise<AnalysisResult> {
  try {
    return await analyzeChapters(files, options);
  } catch (error) {
    if (error instanceof DiffStoryError) {
      throw error;
    }
    throw Errors.llmCallFailed(error instanceof Error ? error.message : String(error));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadChapters(path: string, io: Io, files: DiffFile[]): Promise<Chapter[]> {
  let text: string;
  try {
    text = await io.readFile(path);
  } catch (error) {
    throw Errors.chaptersFileUnreadable(
      path,
      error instanceof Error ? error.message : String(error),
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw Errors.invalidChaptersJson(error instanceof Error ? error.message : String(error));
  }

  const candidate = Array.isArray(value) ? value : isRecord(value) ? value.chapters : undefined;
  const chapters = validateChapterArray(candidate);
  return appendLeftovers(pruneUnknownFiles(chapters, files), files);
}

function manualResult(chapters: Chapter[], model: string): AnalysisResult {
  return { chapters, stats: { inputTokens: 0, outputTokens: 0, durationMs: 0, model } };
}

async function readFiles(io: Io): Promise<DiffFile[]> {
  return parseUnifiedDiff(await io.readStdin());
}

export async function runDefault(flags: CliFlags, io: Io): Promise<number> {
  if (flags.jsonSchema) {
    io.write(formatSchema());
    return 0;
  }

  const files = await readFiles(io);

  if (flags.rawPrompt) {
    io.write(`# SYSTEM\n${SYSTEM_PROMPT}\n\n# USER\n${buildUserPrompt(files)}\n`);
    return 0;
  }

  let result: AnalysisResult;
  if (flags.chaptersJson !== undefined) {
    result = manualResult(await loadChapters(flags.chaptersJson, io, files), "chapters-json");
  } else if (flags.dryRun) {
    result = manualResult(
      [
        {
          title: "Full diff",
          synopsis: "Dry run — LLM analysis skipped.",
          files: files.map((file) => file.path),
        },
      ],
      "dry-run",
    );
  } else {
    const { model, maxTokens } = resolveModelOptions(flags, io.env);
    result = await runAnalysis(files, { llm: getLlm(io), model, maxTokens, now: io.now });
  }

  io.write(flags.json ? formatJson(result, files) : formatStory(files, result.chapters));
  return 0;
}

export async function runParse(io: Io): Promise<number> {
  io.write(formatFilesJson(await readFiles(io)));
  return 0;
}

export async function runAnalyze(flags: CliFlags, io: Io): Promise<number> {
  const files = await readFiles(io);
  const { model, maxTokens } = resolveModelOptions(flags, io.env);
  const result = await runAnalysis(files, { llm: getLlm(io), model, maxTokens, now: io.now });
  io.write(formatJson(result, files));
  return 0;
}

export async function runFormat(flags: CliFlags, io: Io): Promise<number> {
  if (flags.chaptersJson === undefined) {
    throw Errors.missingChaptersJson();
  }
  const files = await readFiles(io);
  const chapters = await loadChapters(flags.chaptersJson, io, files);
  const result = manualResult(chapters, "chapters-json");
  io.write(flags.json ? formatJson(result, files) : formatStory(files, chapters));
  return 0;
}
