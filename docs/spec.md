# diff-story specification

## 1. Contract

diff-story is a **deterministic** Unix filter. It never calls a model — the
agent driving it supplies the chapter grouping.

- **Input:** a unified diff on stdin (typically `git diff` output).
- **Output:** on stdout — a plan, parsed files, or an annotated story / JSON.
- **Diagnostics:** human-readable error blocks on stderr.
- **Exit codes:** `0` success, `1` any error.

The I/O contract is the part that must never change. The intelligence lives
entirely in the calling agent, so the tool has no model, key, or network
dependency.

## 2. The agent protocol

```
            ┌──────────────── agent decides chapters ────────────────┐
            │                                                         ▼
git diff ─▶ diff-story (plan) ─▶ {chapters JSON} ─▶ diff-story format ─▶ story
```

1. **plan** (default command): `git diff | diff-story` prints the file manifest
   and the chapters JSON shape to produce.
2. The agent groups every file into an ordered narrative and emits chapters JSON.
3. **format**: `git diff | diff-story format --chapters '<json>'` re-emits the
   diff grouped under chapter banners (or JSON with `--json`).

## 3. Pipeline

```
raw diff ──parser──▶ DiffFile[] ──plan──▶ agent request (text)
                          │
                          └──(agent JSON)──▶ chapters ──formatter──▶ output
```

### 3.1 Parser (`src/parser`)

`parse-diff` is the validity gate (non-empty input that yields zero files is a
`DS_E002` error). Our own splitter produces the verbatim per-file segments:

- Git diffs split on `diff --git ` boundaries.
- Non-git unified diffs split on a `--- ` line immediately followed by `+++ `
  (so a deletion line beginning with `-` is never mistaken for a boundary).

Each `DiffFile` carries `from`, `to`, a display `path` (prefers `to`, falls back
to `from` for deletes), `additions`/`deletions` counts, a `binary` flag, and the
verbatim `rawText`.

### 3.2 Plan (`src/plan`)

`buildPlan(files)` renders the request the agent fulfils: the numbered file
manifest plus the chapters JSON shape and the `format` command to call back.
There is no model call — this is just an instruction string.

### 3.3 Chapters (`src/chapters`)

`parseChaptersJson` accepts a bare array or `{ chapters: [...] }`,
`validateChapterArray` enforces the `{title, synopsis, files[]}` shape, and
`reconcileChapters` drops references to unknown files and appends any unassigned
files as a trailing **Appendix** chapter so nothing is lost. `CHAPTERS_SCHEMA`
is the published JSON Schema (`--json-schema`).

### 3.4 Formatter (`src/formatter`)

- `formatStory` emits, per chapter, a `#`-prefixed banner (number, title,
  wrapped synopsis) followed by the verbatim diffs of that chapter's files.
- `formatJson` emits the resolved story (chapters with per-file stats).
- `formatFilesJson` backs the `parse` command.

## 4. Commands & flags

| Command / flag             | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| default / `plan`           | Print the plan (manifest + chapters to produce). |
| `format --chapters JSON`   | Render the story from inline chapters JSON.      |
| `format --chapters-json F` | Render the story from a chapters file.           |
| `format … --json`          | Emit the resolved story as JSON.                 |
| `parse`                    | Parse the diff to `{ files: [...] }` JSON.       |
| `doctor`                   | Environment self-check (git, parse-diff, Bun).   |
| `--json-schema`            | Print the chapters JSON schema; exit.            |

Inline `--chapters` takes precedence over `--chapters-json`.

## 5. Errors

Every failure is a `DiffStoryError` with a stable code and a What / Why / How
triple. The catalog (`src/errors/index.ts`):

| Code      | Meaning                                           |
| --------- | ------------------------------------------------- |
| `DS_E001` | No diff on stdin.                                 |
| `DS_E002` | Input is not a recognizable diff.                 |
| `DS_E007` | Could not parse CLI arguments.                    |
| `DS_E008` | Unknown command.                                  |
| `DS_E009` | `format` requires `--chapters`/`--chapters-json`. |
| `DS_E010` | Chapters file unreadable.                         |
| `DS_E011` | Chapters JSON is invalid.                         |
| `DS_E999` | Unexpected error.                                 |

## 6. Quality

- 100% line + function coverage (`coverageThreshold = 1.0`).
- Mutation testing via Stryker, break threshold 70.
- `src/io.ts` and `bin/` are the only impure, coverage-excluded files.
