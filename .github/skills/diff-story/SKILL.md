---
name: diff-story
description: >-
  Turn a unified diff (e.g. `git diff`) into an ordered narrative of "chapters"
  so a reviewer reads the change like a book. Use when asked to summarize,
  group, reorder, or explain the structure of a PR/diff, or to produce a review
  reading-order. diff-story does NOT call a model — YOU (the agent) decide the
  chapters and hand them back to it for rendering.
---

# diff-story

`diff-story` is a deterministic Unix filter. It does not call an LLM; you, the
agent, are the intelligence. You ask it for a plan, decide how to group the
changed files into chapters, and hand the grouping back to be rendered.

## When to use

- "Summarize this PR" / "what's the story of this diff?"
- "Group these changes so I can review them in a sensible order."
- Producing a review plan or a changelog-style narrative from a diff.

## Protocol (three steps)

1. **Ask for the plan** — the files to group and the JSON shape to produce:

   ```bash
   git diff main..feature | diff-story
   ```

   This prints the file manifest plus instructions. (No API key, no network.)

2. **Decide the chapters.** Group every file into an ordered sequence where
   earlier chapters set up later ones. Produce JSON of this exact shape (run
   `diff-story --json-schema` for the formal schema):

   ```json
   {
     "chapters": [
       {
         "title": "API contract changes",
         "synopsis": "Adds the shared auth types that later chapters build on.",
         "files": ["src/api/types.ts", "src/api/client.ts"]
       }
     ]
   }
   ```

   Use each path exactly once, copied verbatim. Any file you omit is appended as
   an "Appendix" chapter, so nothing is lost.

3. **Render the story** — pipe the same diff back with your chapters:

   ```bash
   git diff main..feature | diff-story format \
     --chapters '{"chapters":[{"title":"…","synopsis":"…","files":["…"]}]}'
   ```

   Add `--json` for a machine-readable result instead of an annotated diff. For
   large groupings, write the JSON to a file and use `--chapters-json <path>`.

## Commands & flags

| Invocation                               | Needs key | What it does                                 |
| ---------------------------------------- | --------- | -------------------------------------------- |
| `diff-story` / `diff-story plan`         | no        | Print the plan: files + chapters to produce. |
| `diff-story format --chapters '<json>'`  | no        | Render the story from inline chapters.       |
| `diff-story format --chapters-json PATH` | no        | Render the story from a chapters file.       |
| `diff-story format … --json`             | no        | Emit the resolved story as JSON.             |
| `diff-story parse`                       | no        | Parse the diff into files as JSON.           |
| `diff-story --json-schema`               | no        | Print the chapters JSON schema.              |
| `diff-story doctor`                      | no        | Check the environment.                       |

## Output & errors

- stdout: the result. stderr: diagnostics. Exit `0` ok, `1` on error.
- Errors print a stable code plus What / Why / How, e.g. `DS_E009` means
  `format` was called without `--chapters`/`--chapters-json`.
