import { VERSION } from "../version";

export const HELP = `diff-story v${VERSION} — read your diff like a book.

USAGE
  git diff <base>..<head> | diff-story [options]
  diff-story <command> [options]

Reads a unified diff on stdin, asks Claude to group the changed files into an
ordered sequence of "chapters" (a narrative), and writes the diff back to stdout
with chapter banners inserted. The verbatim file diffs are preserved.

COMMANDS
  (default)        Analyze the diff and print the annotated story.
  parse            Parse the diff and print files as JSON. No LLM, no key.
  analyze          Analyze the diff and print chapters as JSON. Requires a key.
  format           Re-emit the diff using chapters from --chapters-json. No LLM.
  doctor           Check the environment (API key, git, parse-diff, runtime).
  help             Show this help.

OPTIONS
  -h, --help               Show this help.
  -v, --version            Print the version.
      --json               Emit machine-readable JSON instead of an annotated diff.
      --json-schema        Print the JSON output schema and exit.
      --raw-prompt         Print the exact prompt that would be sent, then exit. No LLM.
      --dry-run            Skip the LLM; emit a single chapter with every file.
      --chapters-json PATH Use chapters from PATH and skip the LLM.
      --model NAME         Override the model id (default: claude-sonnet-4-6).
      --max-tokens N       Max output tokens for the model (default: 2048).

ENVIRONMENT
  ANTHROPIC_API_KEY   Required for analysis (default and analyze commands).
  DIFF_STORY_MODEL    Default model id; overridden by --model.

EXAMPLES
  git diff main..feature | diff-story
  git diff | diff-story --json | jq '.chapters[].title'
  git diff | diff-story --dry-run
  git diff | diff-story parse
  diff-story doctor

Docs: https://github.com/iemong/diff-story
`;
