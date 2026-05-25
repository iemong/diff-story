import { VERSION } from "../version";

export const HELP = `diff-story v${VERSION} — read your diff like a book.

A deterministic Unix filter. diff-story does NOT call a model itself: the agent
driving it is the intelligence. The agent asks for a plan, decides the chapters,
and hands them back to be rendered.

USAGE
  git diff <base>..<head> | diff-story [command] [options]

PROTOCOL (for the calling agent)
  1. git diff | diff-story            → a plan: the files + the chapters to produce
  2. (you decide the chapters as JSON)
  3. git diff | diff-story format --chapters '<json>'   → the annotated story

  Or run it all in one command with your own agent CLI:
    git diff | diff-story auto

COMMANDS
  (default) / plan   Print the plan: the file manifest and the chapters to produce.
  auto               Drive the whole protocol via your installed agent CLI in one step.
  format             Re-emit the diff grouped under the chapters you supply.
  parse              Parse the diff and print files as JSON.
  doctor             Check the environment (git, parse-diff, runtime).
  help               Show this help.

OPTIONS
  -h, --help               Show this help.
  -v, --version            Print the version.
      --json               (format/auto) Emit JSON instead of an annotated diff.
      --fold               (format/auto) Collapse noise (lockfiles, generated,
                           renames, binaries) to a one-line summary. Off by default.
      --json-schema        Print the chapters JSON schema and exit.
      --chapters JSON      (format) Chapters as an inline JSON string.
      --chapters-json PATH (format) Chapters from a JSON file.
      --agent COMMAND      (auto) Agent CLI to drive, e.g. --agent 'claude -p'.
                           Defaults to the first of claude, codex found on PATH.

EXAMPLES
  git diff main..feature | diff-story
  git diff | diff-story auto
  git diff | diff-story auto --agent 'claude -p'
  git diff | diff-story format --chapters '{"chapters":[{"title":"Setup","synopsis":"…","files":["src/a.ts"]}]}'
  git diff | diff-story format --chapters-json chapters.json --json
  git diff | diff-story parse
  diff-story --json-schema
  diff-story doctor

Docs: https://github.com/iemong/diff-story
`;
