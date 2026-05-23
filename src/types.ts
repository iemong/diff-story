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

/**
 * Every side effect the CLI needs, injected so the core logic stays pure and
 * testable. The production wiring lives in `src/io.ts`. There is no model
 * client here: diff-story is a deterministic filter and the calling agent is
 * the intelligence.
 */
export interface Io {
  readStdin(): Promise<string>;
  readFile(path: string): Promise<string>;
  write(text: string): void;
  writeError(text: string): void;
  bunVersion: string;
  which(command: string): Promise<string | null>;
}
