# AGENTS.md

diff-story is built primarily for AI agents. The full working contract lives in
[`CLAUDE.md`](./CLAUDE.md) — read it. This file is the short version for any
agent runtime (Codex, Cursor, etc.).

## Calling the tool

```bash
git diff main..feature | diff-story            # annotated story on stdout
git diff | diff-story --json                   # machine-readable JSON
git diff | diff-story --json-schema            # the JSON output schema
git diff | diff-story --dry-run                # no model call; one chapter
git diff | diff-story parse                    # parsed files as JSON (no key)
diff-story doctor                              # self-check the environment
```

- Needs a unified diff on **stdin**. Writes to **stdout**. Diagnostics and the
  What/Why/How error blocks go to **stderr**. Exit code `0` = success, `1` =
  any error.
- Analysis (default and `analyze`) needs `ANTHROPIC_API_KEY`. `parse`,
  `format`, `--dry-run`, `--raw-prompt`, and `--json-schema` do not.
- Prefer `--json` when you will parse the result; the shape is published by
  `--json-schema`.

## Working in the repo

- Runtime is **Bun**. Tests: `bun test` (100% coverage gate). Mutation:
  `bun run mutation`. Lint/format: `bun run lint` / `bun run format`.
- Add tests with every code change; keep all logic out of `src/io.ts` and
  `bin/` so it stays covered.
- Errors are typed (`DiffStoryError`) with stable `DS_Exxx` codes — add to the
  catalog in `src/errors/index.ts`, never invent ad-hoc throws in logic.
