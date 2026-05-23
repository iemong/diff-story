/** A single file's changes within a unified diff. */
export interface DiffFile {
  /** Path before the change, or `/dev/null` for an added file. */
  from: string;
  /** Path after the change, or `/dev/null` for a deleted file. */
  to: string;
  /** Display path: prefers `to`, falling back to `from`. */
  path: string;
  /** Number of added lines. */
  additions: number;
  /** Number of removed lines. */
  deletions: number;
  /** Whether this file is a binary patch. */
  binary: boolean;
  /** Verbatim diff text for this file, including its `diff --git` header. */
  rawText: string;
}

/** A chapter groups related files into one beat of the change's story. */
export interface Chapter {
  /** Chapter title, e.g. "API contract changes". */
  title: string;
  /** One- or two-sentence synopsis (あらすじ) of the chapter. */
  synopsis: string;
  /** Display paths of the files in this chapter, in reading order. */
  files: string[];
}

/** Token/timing accounting for a single analysis run. */
export interface AnalysisStats {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model: string;
}

/** The full result of analyzing a diff into chapters. */
export interface AnalysisResult {
  chapters: Chapter[];
  stats: AnalysisStats;
}

/** A model request, decoupled from any specific SDK. */
export interface LlmRequest {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
}

/** A model response, decoupled from any specific SDK. */
export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * The only LLM capability diff-story depends on. Swapping Claude for another
 * provider (or a local model) means implementing this one method.
 */
export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/**
 * Every side effect the CLI needs, injected so the core logic stays pure and
 * testable. The production wiring lives in `src/io.ts`.
 */
export interface Io {
  readStdin(): Promise<string>;
  readFile(path: string): Promise<string>;
  write(text: string): void;
  writeError(text: string): void;
  env: Record<string, string | undefined>;
  now(): number;
  bunVersion: string;
  which(command: string): Promise<string | null>;
  createLlm(apiKey: string): LlmClient;
}
