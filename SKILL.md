---
name: diff-story
description: >-
  Turn a unified diff (e.g. `git diff`) into an ordered narrative of "chapters"
  so a reviewer reads the change like a book. Use when asked to summarize,
  group, reorder, or explain the structure of a PR/diff, or to produce a review
  reading-order. Reads a diff on stdin and writes either an annotated diff or
  JSON.
---

# diff-story

`diff-story` is a Unix filter: a unified diff goes in on stdin, an AI groups the
changed files into an ordered sequence of **chapters** (each with a title and a
one-line **synopsis**), and the diff comes back out grouped under chapter
banners. The verbatim file diffs are preserved.

## When to use

- "Summarize this PR" / "what's the story of this diff?"
- "Group these changes so I can review them in a sensible order."
- Producing a review plan or a changelog-style narrative from a diff.

## Usage

Pipe a diff in. Analysis requires `ANTHROPIC_API_KEY`.

```bash
# Annotated story (human-readable diff with chapter banners)
git diff main..feature | diff-story

# Machine-readable JSON (preferred when you will parse the output)
git diff main..feature | diff-story --json
```

`--json` output (see `diff-story --json-schema` for the full schema):

```json
{
  "chapters": [
    {
      "title": "API contract changes",
      "synopsis": "Adds the auth types and client that later chapters build on.",
      "files": [{ "path": "src/api/types.ts", "additions": 40, "deletions": 2, "binary": false }]
    }
  ],
  "stats": {
    "inputTokens": 4200,
    "outputTokens": 320,
    "durationMs": 3100,
    "model": "claude-sonnet-4-6"
  }
}
```

## Subcommands & flags

| Invocation                            | Needs key | What it does                                 |
| ------------------------------------- | --------- | -------------------------------------------- |
| `diff-story` (default)                | yes       | Analyze and print the annotated story.       |
| `diff-story --json`                   | yes       | Analyze and print JSON.                      |
| `diff-story analyze`                  | yes       | Print chapters as JSON.                      |
| `diff-story parse`                    | no        | Parse the diff into files as JSON.           |
| `diff-story format --chapters-json F` | no        | Re-emit the diff using chapters you supply.  |
| `diff-story --dry-run`                | no        | Skip the model; one chapter with every file. |
| `diff-story --raw-prompt`             | no        | Print the exact prompt that would be sent.   |
| `diff-story --json-schema`            | no        | Print the JSON output schema.                |
| `diff-story doctor`                   | no        | Check the environment.                       |

Other flags: `--model NAME` (default `claude-sonnet-4-6`, or `DIFF_STORY_MODEL`),
`--max-tokens N`.

## Output & errors

- stdout: the result. stderr: diagnostics. Exit `0` ok, `1` on error.
- Errors print a stable code plus What / Why / How, e.g. `DS_E003` means
  `ANTHROPIC_API_KEY` is not set — run `diff-story doctor` to diagnose.
