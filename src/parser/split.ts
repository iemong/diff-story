/** Pure helpers that turn raw unified-diff text into per-file segments. */

const NONE = 0;
const ADJACENT = 1;
const PREFIX_LENGTH = 2;
const MARKER_LENGTH = 4;
const NOT_FOUND = -1;

/**
 * Split a unified diff into verbatim per-file segments.
 *
 * Git diffs are split on `diff --git` boundaries (unambiguous). For non-git
 * unified diffs we split on a `--- ` line immediately followed by a `+++ `
 * line, which avoids misfiring on deletion lines that merely start with `-`.
 */
export const splitDiffIntoFiles = (raw: string): string[] => {
  if (raw.trim() === "") {
    return [];
  }

  const lines = raw.split("\n");
  const isGit = lines.some((line) => line.startsWith("diff --git "));
  const boundaries: number[] = [];

  for (let index = NONE; index < lines.length; index++) {
    const line = lines[index];
    if (isGit) {
      if (line.startsWith("diff --git ")) {
        boundaries.push(index);
      }
    } else if (
      line.startsWith("--- ") &&
      lines[index + ADJACENT] !== undefined &&
      lines[index + ADJACENT].startsWith("+++ ")
    ) {
      boundaries.push(index);
    }
  }

  if (boundaries.length === NONE) {
    return [raw];
  }

  const segments: string[] = [];
  for (let boundaryIndex = NONE; boundaryIndex < boundaries.length; boundaryIndex++) {
    const start = boundaries[boundaryIndex];
    let end = lines.length;
    if (boundaryIndex + ADJACENT < boundaries.length) {
      end = boundaries[boundaryIndex + ADJACENT];
    }
    segments.push(lines.slice(start, end).join("\n"));
  }
  return segments;
};

/** Strip a leading `a/` or `b/` prefix and any trailing tab-delimited timestamp. */
export const stripPathToken = (token: string): string => {
  let value = token;
  const tab = value.indexOf("\t");
  if (tab !== NOT_FOUND) {
    value = value.slice(NONE, tab);
  }
  value = value.trim();
  if (value === "/dev/null") {
    return value;
  }
  if (value.startsWith("a/") || value.startsWith("b/")) {
    return value.slice(PREFIX_LENGTH);
  }
  return value;
};

/** Parse the `diff --git a/x b/y` header line into its two paths. */
export const parseGitHeader = (line: string): { from: string; to: string } | undefined => {
  const match = line.match(/^diff --git a\/(.+) b\/(.+)$/u);
  if (!match) {
    return undefined;
  }
  const [, from, to] = match;
  return { from, to };
};

/** Extract the from/to paths and binary flag from a single file segment. */
export const parseSegmentMeta = (
  segment: string,
): { from: string; to: string; binary: boolean } => {
  const lines = segment.split("\n");
  let from = "";
  let to = "";
  let binary = false;
  let sawMinus = false;
  let sawPlus = false;

  for (const line of lines) {
    if (line.startsWith("--- ")) {
      from = stripPathToken(line.slice(MARKER_LENGTH));
      sawMinus = true;
    } else if (line.startsWith("+++ ")) {
      to = stripPathToken(line.slice(MARKER_LENGTH));
      sawPlus = true;
    } else if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      binary = true;
    }
  }

  if (!sawMinus || !sawPlus) {
    const gitLine = lines.find((line) => line.startsWith("diff --git "));
    if (gitLine !== undefined) {
      const parsed = parseGitHeader(gitLine);
      if (parsed !== undefined) {
        ({ from, to } = parsed);
      }
    }
  }

  return { binary, from, to };
};

/** Count added/removed content lines in a file segment. */
export const countChanges = (segment: string): { additions: number; deletions: number } => {
  let additions = 0;
  let deletions = 0;
  for (const line of segment.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }
  return { additions, deletions };
};
