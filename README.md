# diff-story

> Every PR tells a story. Read your diff like a book.

`diff-story` is a Unix filter that reorders a pull-request diff into an AI-analyzed
sequence of **chapters**. Pipe a `git diff` in; get the same diff back, grouped
under chapter banners that tell the story of the change — earlier chapters set up
the context that later ones build on.

```bash
git diff main..feature | diff-story
```

```diff
# ════════════════════════════════════════════════════════════
# 📖 Chapter 1/3 — API contract changes
#
# Synopsis: Adds the auth types and client the later chapters build on.
# ════════════════════════════════════════════════════════════

diff --git a/src/api/types.ts b/src/api/types.ts
...
```

It is built **AI-agent-first**: the primary user is a coding agent, with humans a
close second. That shows up everywhere — machine-readable output, a published
schema, a `doctor` self-check, and errors that always explain What / Why / How.

## Install

```bash
bun install -g diff-story    # or run from a clone: bun run start < diff.patch
```

Requires [Bun](https://bun.sh) — the executable runs under `bun` via its
shebang. Analysis uses the Claude API, so set `ANTHROPIC_API_KEY` (commands that
don't call the model don't need it).

## Usage

```bash
git diff main..feature | diff-story                 # annotated story
git diff | diff-story --json | jq '.chapters[].title'  # machine-readable JSON
git diff | diff-story --json-schema                 # the output schema
git diff | diff-story --dry-run                     # no model call; one chapter
git diff | diff-story --raw-prompt                  # print the prompt; no model call
git diff | diff-story parse                         # parsed files as JSON (no key)
diff-story doctor                                   # check the environment
```

### Commands

| Command                               | Needs key | Description                                  |
| ------------------------------------- | --------- | -------------------------------------------- |
| `diff-story` (default)                | yes       | Analyze and print the annotated story.       |
| `diff-story analyze`                  | yes       | Analyze and print chapters as JSON.          |
| `diff-story parse`                    | no        | Parse the diff into files as JSON.           |
| `diff-story format --chapters-json F` | no        | Re-emit the diff using chapters you supply.  |
| `diff-story doctor`                   | no        | Check API key, git, parse-diff, and runtime. |

### Options

| Flag                   | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `--json`               | Emit machine-readable JSON instead of an annotated diff. |
| `--json-schema`        | Print the JSON output schema and exit.                   |
| `--raw-prompt`         | Print the exact prompt that would be sent, then exit.    |
| `--dry-run`            | Skip the model; emit a single chapter with every file.   |
| `--chapters-json PATH` | Use chapters from `PATH` and skip the model.             |
| `--model NAME`         | Override the model id (default `claude-sonnet-4-6`).     |
| `--max-tokens N`       | Max output tokens (default `2048`).                      |
| `-h, --help`           | Show help. `-v, --version` prints the version.           |

`stdout` carries the result, `stderr` the diagnostics, and the exit code is `0`
on success / `1` on any error. Errors print a stable code (`DS_Exxx`) plus a
What / Why / How block.

## How it works

```
raw diff ──parser──▶ DiffFile[] ──analyzer──▶ Chapter[] ──formatter──▶ output
                                    (LLM)
```

Only the analyzer touches the model, behind a one-method `LlmClient` interface,
so the model — or the whole provider — can change without touching the Unix I/O
contract. See [`docs/spec.md`](./docs/spec.md) and [`CLAUDE.md`](./CLAUDE.md).

## Development

```bash
bun install
bun test            # tests with a 100% coverage gate
bun run typecheck   # tsc --noEmit
bun run lint        # oxlint
bun run format      # oxfmt
bun run mutation    # Stryker mutation testing
bun run check       # everything above
```

Quality bars: **100% line + function coverage** (enforced in `bunfig.toml`),
**mutation testing** via Stryker, **oxlint** + **oxfmt**, and **lefthook** git
hooks (format/lint/typecheck on commit, tests on push).

## License

MIT
