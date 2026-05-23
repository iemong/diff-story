# diff-story — agent guide

> Unix filter that reorders a PR diff into AI-analyzed **chapters**. Read your diff like a book.

This file is the contract for working in this repo. It is written for an AI
agent (the primary user) as much as for a human.

## What it does

`git diff` on stdin → group the changed files into an ordered narrative of
**chapters** → the same diff on stdout, with chapter banners inserted. The
verbatim per-file diffs are preserved, so any viewer can still render them.

```
git diff main..feature | diff-story
```

## Design principles (do not violate)

This tool follows the "AI-agent-friendly CLI" frame: the main user is an agent,
a human is secondary.

1. **Three kinds of capability.**
   - _Primitives_ — CRUD on one concept: `parse`, `analyze`, `format`.
   - _Integration_ — the domain operation: the default command (stdin → stdout).
   - _Escape hatches_ — `--raw-prompt`, `--dry-run`, `--chapters-json`, `--json`.
2. **Fill the agent's context.** Rich `--help`, `--json` for machine output,
   `--json-schema` to publish the contract, `doctor` to self-check, and errors
   that always carry **What / Why / How** plus a stable code (`DS_Exxx`).
3. **Invest in what doesn't change.** The I/O contract is Unix
   (stdin/stdout/exit codes). The LLM lives behind one interface (`LlmClient`),
   so the model — or the whole provider — can change without touching the
   contract.

## Vocabulary (keep it literary, not jargon)

| Concept          | Name in code            |
| ---------------- | ----------------------- |
| group of files   | **chapter**             |
| one-line summary | **synopsis** (あらすじ) |
| the whole output | **story**               |

## Architecture

Only `analyzer` talks to the LLM. Everything else is pure and trivially
testable.

```
src/
├── parser/      unified diff → DiffFile[]        (no LLM)
├── analyzer/    DiffFile[]   → Chapter[]         (the only LLM dependency)
├── formatter/   DiffFile[] + Chapter[] → string  (no LLM)
├── cli/         arg parsing, command routing, doctor, help
├── errors/      DiffStoryError + the What/Why/How catalog
├── io.ts        the one impure module (stdin/stdout/network) — DI'd everywhere
├── main.ts      main(argv, io) — pure, returns an exit code
└── types.ts     shared domain + Io + LlmClient interfaces
```

The whole program is `main(argv: string[], io: Io): Promise<number>`. Every
side effect is on `io`, injected by the caller. `bin/diff-story.ts` is the only
place that wires the real `io` and calls `process.exit`.

## Non-negotiable quality bars

- **Test coverage is 100%** (lines + functions), enforced by
  `coverageThreshold = 1.0` in `bunfig.toml`. `bun test` fails below it.
- **Mutation testing** runs via Stryker (`bun run mutation`), break threshold 70.
- **Lint/format** via oxlint + oxfmt. **Hooks** via lefthook (pre-commit:
  format/lint/typecheck; pre-push: test).

When you add code, add tests in the same change. Keep `io.ts` and
`bin/diff-story.ts` as the only untested shell (they are excluded from
coverage); push all logic into pure modules so it can be covered.

## Commands

```bash
bun test            # run tests (coverage on, 100% gate)
bun run typecheck   # tsc --noEmit
bun run lint        # oxlint
bun run format      # oxfmt . (write); format:check to verify
bun run mutation    # Stryker mutation testing
bun run check       # typecheck + lint + format:check + test:cov
bun run start ...   # run the CLI from source
```

## Errors

Throw `DiffStoryError` via the `Errors.*` factory in `src/errors/index.ts`.
Never throw a bare string or a plain `Error` from logic — `main` will still
catch it (as `DS_E999`), but a typed error gives the agent a code and a fix.
Add new error codes to the catalog; keep codes stable and unique.
