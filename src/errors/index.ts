/**
 * Structured errors. Every failure carries a stable code plus a What / Why /
 * How triple so that both humans and agents get an actionable message instead
 * of a stack trace.
 */
export interface ErrorInfo {
  code: string;
  what: string;
  why: string;
  how: string;
}

export class DiffStoryError extends Error {
  readonly code: string;
  readonly what: string;
  readonly why: string;
  readonly how: string;

  constructor(info: ErrorInfo) {
    super(`${info.code}: ${info.what}`);
    this.name = "DiffStoryError";
    this.code = info.code;
    this.what = info.what;
    this.why = info.why;
    this.how = info.how;
  }

  /** Render the error as a human-readable What / Why / How block. */
  format(): string {
    return [
      `✗ ${this.what} (${this.code})`,
      "",
      `  What:  ${this.what}`,
      `  Why:   ${this.why}`,
      `  How:   ${this.how}`,
      "",
    ].join("\n");
  }
}

/** The catalog of every error diff-story can raise. */
export const Errors = {
  emptyInput: (): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E001",
      what: "No diff was provided on stdin",
      why: "diff-story is a filter and needs a unified diff piped into it",
      how: "Pipe a diff in, e.g. `git diff main..HEAD | diff-story`",
    }),

  noDiffFound: (): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E002",
      what: "The input did not contain a recognizable diff",
      why: "parse-diff found no file sections in the input",
      how: "Make sure you pipe `git diff` output, not a commit message or plain text",
    }),

  badArguments: (detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E007",
      what: "The command-line arguments could not be parsed",
      why: detail,
      how: "Run `diff-story --help` to see the supported commands and flags",
    }),

  unknownCommand: (command: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E008",
      what: `Unknown command "${command}"`,
      why: "That is not one of the diff-story subcommands",
      how: "Use one of: parse, analyze, format, doctor, help — or run `diff-story --help`",
    }),

  missingChapters: (): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E009",
      what: "The format command requires --chapters or --chapters-json",
      why: "format re-emits a diff using chapters you supply; there is nothing to format without them",
      how: "Run `diff-story plan` to get the chapters to produce, then pass them with --chapters '<json>' or --chapters-json <path>",
    }),

  chaptersFileUnreadable: (path: string, detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E010",
      what: `Could not read chapters file "${path}"`,
      why: detail,
      how: "Check the path exists and is readable",
    }),

  invalidChaptersJson: (detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E011",
      what: "The chapters JSON is invalid",
      why: detail,
      how: 'Provide {"chapters":[{"title","synopsis","files":[...]}]} or a bare array of chapters',
    }),

  unexpected: (detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E999",
      what: "An unexpected error occurred",
      why: detail,
      how: "Please report this at https://github.com/iemong/diff-story/issues",
    }),
};
