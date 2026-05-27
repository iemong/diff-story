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
  agentFailed: (command: string, detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E021",
      how: "Check the agent runs on its own, pass another with --agent, or drive the manual `plan` → `format` protocol",
      what: `The agent "${command}" failed to produce chapters`,
      why: detail,
    }),

  agentNotFound: (tried: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E020",
      how: "Install one of them, pass your own with --agent '<command>', or drive the manual `plan` → `format` protocol yourself",
      what: "No coding-agent CLI was found to drive `auto`",
      why: `none of the known agents are on PATH (tried: ${tried})`,
    }),

  badArguments: (detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E007",
      how: "Run `diff-story --help` to see the supported commands and flags",
      what: "The command-line arguments could not be parsed",
      why: detail,
    }),

  chaptersFileUnreadable: (path: string, detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E010",
      how: "Check the path exists and is readable",
      what: `Could not read chapters file "${path}"`,
      why: detail,
    }),

  emptyInput: (): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E001",
      how: "Pipe a diff in, e.g. `git diff main..HEAD | diff-story`",
      what: "No diff was provided on stdin",
      why: "diff-story is a filter and needs a unified diff piped into it",
    }),

  invalidChaptersJson: (detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E011",
      how: 'Provide {"chapters":[{"title","synopsis","files":[...]}]} or a bare array of chapters',
      what: "The chapters JSON is invalid",
      why: detail,
    }),

  missingChapters: (): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E009",
      how: "Run `diff-story plan` to get the chapters to produce, then pass them with --chapters '<json>' or --chapters-json <path>",
      what: "The format command requires --chapters or --chapters-json",
      why: "format re-emits a diff using chapters you supply; there is nothing to format without them",
    }),

  noDiffFound: (): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E002",
      how: "Make sure you pipe `git diff` output, not a commit message or plain text",
      what: "The input did not contain a recognizable diff",
      why: "parse-diff found no file sections in the input",
    }),

  unexpected: (detail: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E999",
      how: "Please report this at https://github.com/iemong/diff-story/issues",
      what: "An unexpected error occurred",
      why: detail,
    }),

  unknownCommand: (command: string): DiffStoryError =>
    new DiffStoryError({
      code: "DS_E008",
      how: "Use one of: plan, auto, parse, format, doctor, help — or run `diff-story --help`",
      what: `Unknown command "${command}"`,
      why: "That is not one of the diff-story subcommands",
    }),
};
