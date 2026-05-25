import { CHAPTERS_SHAPE, buildManifest } from "../plan";
import type { DiffFile, Io } from "../types";
import { Errors } from "../errors";

const NOT_FOUND = -1;
const FIRST = 0;
const REST = 1;

/** An external agent CLI invocation: a command plus its leading arguments. */
export interface AgentSpec {
  command: string;
  args: string[];
}

/**
 * Known coding-agent CLIs, in detection order. Each reads its prompt from
 * stdin, so `auto` pipes the diff in and reads the chapters JSON back out.
 */
export const KNOWN_AGENTS: AgentSpec[] = [
  { args: ["-p"], command: "claude" },
  { args: ["exec", "-"], command: "codex" },
];

/** Parse a `--agent` override ("claude -p") into a command plus its arguments. */
export const parseAgentOverride = (raw: string): AgentSpec => {
  const parts = raw.trim().split(/\s+/u);
  return { args: parts.slice(REST), command: parts[FIRST] };
};

/** Pick the agent for `auto`: an explicit override, else the first known CLI on PATH. */
export const detectAgent = async (io: Io, override?: string): Promise<AgentSpec> => {
  if (override !== undefined) {
    return parseAgentOverride(override);
  }
  const found = await Promise.all(KNOWN_AGENTS.map((agent) => io.which(agent.command)));
  const index = found.findIndex((path) => path !== undefined);
  if (index === NOT_FOUND) {
    throw Errors.agentNotFound(KNOWN_AGENTS.map((agent) => agent.command).join(", "));
  }
  return KNOWN_AGENTS[index];
};

/** Build the self-contained prompt handed to the agent: instructions + manifest + diff. */
export const buildAutoPrompt = (files: DiffFile[], rawDiff: string): string =>
  [
    "Group the changed files below into an ordered sequence of chapters that",
    "reads as a narrative: earlier chapters set up the context later ones build on.",
    "",
    "Reply with ONLY a JSON object of this exact shape — no prose, no code fences:",
    `    ${CHAPTERS_SHAPE}`,
    "",
    "Rules: use each file path below exactly once, copied verbatim; keep each",
    "synopsis to one or two sentences; order chapters as a reading sequence.",
    "",
    `Files (${files.length}):`,
    buildManifest(files),
    "",
    "The unified diff:",
    rawDiff,
  ].join("\n");

const PAIRS = [
  { close: "}", open: "{" },
  { close: "]", open: "[" },
];

const earliestPair = (text: string): { start: number; open: string; close: string } => {
  let start = NOT_FOUND;
  let open = "{";
  let close = "}";
  for (const pair of PAIRS) {
    const at = text.indexOf(pair.open);
    if (at !== NOT_FOUND && (start === NOT_FOUND || at < start)) {
      start = at;
      ({ open, close } = pair);
    }
  }
  return { close, open, start };
};

/**
 * Return the substring of `text` (which must start with `open`) up to and
 * including the delimiter that balances it, ignoring delimiters that appear
 * inside JSON string literals. Falls back to the whole text if it never
 * balances, so a truncated reply surfaces as an invalid-JSON error downstream.
 */
const sliceBalanced = (text: string, open: string, close: string): string => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let index = 0;
  for (const ch of text) {
    index += REST;
    if (escaped) {
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString && ch === open) {
      depth += REST;
    } else if (!inString && ch === close && --depth === FIRST) {
      return text.slice(FIRST, index);
    }
  }
  return text;
};

/** Pull the JSON payload out of an agent reply that may wrap it in prose or fences. */
export const extractJsonText = (raw: string): string => {
  const fence = /```(?:json)?\s*([\s\S]*?)```/u.exec(raw);
  let body = raw;
  if (fence !== null) {
    [, body] = fence;
  }
  const { start, open, close } = earliestPair(body);
  if (start === NOT_FOUND) {
    return body.trim();
  }
  return sliceBalanced(body.slice(start), open, close).trim();
};
