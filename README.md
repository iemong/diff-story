# diff-story

> Every PR tells a story. Read your diff like a book.

`diff-story` reorders a pull-request diff into an ordered sequence of
**chapters** so a reviewer reads the change like a narrative — earlier chapters
set up the context that later ones build on.

It is a **deterministic Unix filter that never calls a model.** The agent
driving it (Claude Code, Codex, Cursor, …) is the intelligence: the tool hands
the agent a plan, the agent decides the chapters, and the tool renders them. No
API key, no network, no cost inside the tool.

```diff
# ════════════════════════════════════════════════════════════
# 📖 Chapter 1/3 — API contract changes
#
# Synopsis: Adds the auth types and client the later chapters build on.
# ════════════════════════════════════════════════════════════

diff --git a/src/api/types.ts b/src/api/types.ts
...
```

## Install

```bash
bun install -g diff-story    # or run from a clone: bun run start < diff.patch
```

Requires [Bun](https://bun.sh) — the executable runs under `bun` via its shebang.

## Install the agent skill

This repo ships an [Agent Skill](https://github.blog/changelog/2026-04-16-manage-agent-skills-with-github-cli/)
at `.github/skills/diff-story/SKILL.md` that teaches your agent the protocol
below. Install it with the GitHub CLI:

```bash
gh skill install iemong/diff-story
```

The skill is what makes an agent reach for `diff-story` when you ask it to
summarize, group, or reorder a diff — the agent then decides the chapters and
hands them back to the CLI for rendering.

## How it works (the agent protocol)

```bash
# 1. Ask for the plan: the files to group + the JSON shape to produce.
git diff main..feature | diff-story

# 2. (the agent decides the chapters as JSON)

# 3. Render the story by handing the chapters back.
git diff main..feature | diff-story format \
  --chapters '{"chapters":[{"title":"Setup","synopsis":"…","files":["src/a.ts"]}]}'
```

Omitted files are appended as an "Appendix" chapter, so nothing is lost. Run
`diff-story --json-schema` for the formal chapters schema.

## Commands

| Command                                  | Description                                  |
| ---------------------------------------- | -------------------------------------------- |
| `diff-story` / `diff-story plan`         | Print the plan: files + chapters to produce. |
| `diff-story format --chapters '<json>'`  | Render the story from inline chapters.       |
| `diff-story format --chapters-json PATH` | Render the story from a chapters file.       |
| `diff-story parse`                       | Parse the diff into files as JSON.           |
| `diff-story doctor`                      | Check git, parse-diff, and the runtime.      |

### Options

| Flag                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `--chapters JSON`      | (format) Chapters as an inline JSON string.      |
| `--chapters-json PATH` | (format) Chapters from a JSON file.              |
| `--json`               | (format) Emit JSON instead of an annotated diff. |
| `--json-schema`        | Print the chapters JSON schema and exit.         |
| `-h, --help`           | Show help. `-v, --version` prints the version.   |

`stdout` carries the result, `stderr` the diagnostics, and the exit code is `0`
on success / `1` on any error. Errors print a stable code (`DS_Exxx`) plus a
What / Why / How block.

## Use as a library

The portable core is published to JSR with no model dependency:

```ts
import {
  parseUnifiedDiff,
  buildPlan,
  parseChaptersJson,
  reconcileChapters,
  formatStory,
} from "@iemong/diff-story";

const files = parseUnifiedDiff(rawDiff);
const plan = buildPlan(files); // hand this to your agent
const chapters = reconcileChapters(parseChaptersJson(agentJson), files);
const story = formatStory(files, chapters);
```

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
