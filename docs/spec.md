# diff-story specification

## 1. Contract

diff-story is a Unix filter.

- **Input:** a unified diff on stdin (typically `git diff` output).
- **Output:** on stdout, either an annotated diff (default) or JSON (`--json`).
- **Diagnostics:** human-readable error blocks on stderr.
- **Exit codes:** `0` success, `1` any error.

The I/O contract is the part that must never change. The model behind the
analysis is an implementation detail hidden behind `LlmClient`.

## 2. Pipeline

```
raw diff ──parser──▶ DiffFile[] ──analyzer──▶ Chapter[] ──formatter──▶ output
                                    (LLM)
```

### 2.1 Parser (`src/parser`)

`parse-diff` is the validity gate (non-empty input that yields zero files is a
`DS_E002` error). Our own splitter produces the verbatim per-file segments:

- Git diffs split on `diff --git ` boundaries.
- Non-git unified diffs split on a `--- ` line immediately followed by `+++ `
  (so a deletion line beginning with `-` is never mistaken for a boundary).

Each `DiffFile` carries `from`, `to`, a display `path` (prefers `to`, falls back
to `from` for deletes), `additions`/`deletions` counts, a `binary` flag, and the
verbatim `rawText`.

### 2.2 Analyzer (`src/analyzer`) — the only LLM stage

1. `buildUserPrompt` renders a manifest: each file's path, +/- counts, and a
   (truncated) copy of its diff.
2. The model is asked to return JSON: an ordered array of chapters, each with a
   `title`, a `synopsis`, and the list of file paths it owns, using each path
   exactly once.
3. `parseChapterResponse` extracts the JSON (tolerating prose or ```json
   fences), validates the shape, drops references to unknown files, and appends
   any unassigned files as a trailing **Appendix** chapter so nothing is lost.

The provider is abstracted to one method:

```ts
interface LlmClient {
  complete(req: { system; user; model; maxTokens }): Promise<{ text; inputTokens; outputTokens }>;
}
```

`createAnthropicClient` adapts the Anthropic SDK to it. Swapping providers means
implementing `LlmClient`; nothing else changes.

#### Prompt (shape)

- **System:** establishes the "narrative of chapters" task.
- **User:** the file manifest + the JSON response instruction.

Prompts live in `src/analyzer/prompt.ts` so they are versioned, diffable, and
unit-tested — the design is externalized, not implicit.

### 2.3 Formatter (`src/formatter`)

- `formatStory` emits, per chapter, a `#`-prefixed banner (number, title,
  wrapped synopsis) followed by the verbatim diffs of that chapter's files.
- `formatJson` emits the machine-readable result; its schema is published by
  `--json-schema` (`OUTPUT_JSON_SCHEMA`).

## 3. Commands & flags

| Command / flag             | LLM | Purpose                                            |
| -------------------------- | --- | -------------------------------------------------- |
| default                    | ✓   | Analyze → annotated story (or JSON with `--json`). |
| `parse`                    | ✗   | Parse the diff to `{ files: [...] }` JSON.         |
| `analyze`                  | ✓   | Analyze → `{ chapters, stats }` JSON.              |
| `format --chapters-json F` | ✗   | Re-emit using supplied chapters.                   |
| `doctor`                   | ✗   | Environment self-check.                            |
| `--dry-run`                | ✗   | One chapter containing every file.                 |
| `--raw-prompt`             | ✗   | Print the exact prompt; exit.                      |
| `--json-schema`            | ✗   | Print the output schema; exit.                     |
| `--model`, `--max-tokens`  | –   | Override model id / output budget.                 |

Model id resolution: `--model` › `DIFF_STORY_MODEL` › default
(`claude-sonnet-4-6`).

## 4. Errors

Every failure is a `DiffStoryError` with a stable code and a What / Why / How
triple. The catalog (`src/errors/index.ts`):

| Code      | Meaning                                   |
| --------- | ----------------------------------------- |
| `DS_E001` | No diff on stdin.                         |
| `DS_E002` | Input is not a recognizable diff.         |
| `DS_E003` | `ANTHROPIC_API_KEY` not set.              |
| `DS_E004` | Model request failed.                     |
| `DS_E005` | Model response could not be parsed.       |
| `DS_E006` | `--max-tokens` is not a positive integer. |
| `DS_E007` | Could not parse CLI arguments.            |
| `DS_E008` | Unknown command.                          |
| `DS_E009` | `format` requires `--chapters-json`.      |
| `DS_E010` | Chapters file unreadable.                 |
| `DS_E011` | Chapters JSON is invalid.                 |
| `DS_E999` | Unexpected error.                         |

## 5. Quality

- 100% line + function coverage (`coverageThreshold = 1.0`).
- Mutation testing via Stryker, break threshold 70.
- `src/io.ts` and `bin/` are the only impure, coverage-excluded files.
