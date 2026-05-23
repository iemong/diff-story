/** Pure helpers that turn raw unified-diff text into per-file segments. */

/**
 * Split a unified diff into verbatim per-file segments.
 *
 * Git diffs are split on `diff --git` boundaries (unambiguous). For non-git
 * unified diffs we split on a `--- ` line immediately followed by a `+++ `
 * line, which avoids misfiring on deletion lines that merely start with `-`.
 */
export function splitDiffIntoFiles(raw: string): string[] {
  if (raw.trim() === "") {
    return [];
  }

  const lines = raw.split("\n");
  const isGit = lines.some((line) => line.startsWith("diff --git "));
  const boundaries: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isGit) {
      if (line.startsWith("diff --git ")) {
        boundaries.push(i);
      }
    } else if (
      line.startsWith("--- ") &&
      lines[i + 1] !== undefined &&
      lines[i + 1].startsWith("+++ ")
    ) {
      boundaries.push(i);
    }
  }

  if (boundaries.length === 0) {
    return [raw];
  }

  const segments: string[] = [];
  for (let b = 0; b < boundaries.length; b++) {
    const start = boundaries[b];
    const end = b + 1 < boundaries.length ? boundaries[b + 1] : lines.length;
    segments.push(lines.slice(start, end).join("\n"));
  }
  return segments;
}

/** Strip a leading `a/` or `b/` prefix and any trailing tab-delimited timestamp. */
export function stripPathToken(token: string): string {
  let value = token;
  const tab = value.indexOf("\t");
  if (tab !== -1) {
    value = value.slice(0, tab);
  }
  value = value.trim();
  if (value === "/dev/null") {
    return value;
  }
  if (value.startsWith("a/") || value.startsWith("b/")) {
    return value.slice(2);
  }
  return value;
}

/** Parse the `diff --git a/x b/y` header line into its two paths. */
export function parseGitHeader(line: string): { from: string; to: string } | null {
  const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
  if (match === null) {
    return null;
  }
  return { from: match[1], to: match[2] };
}

/** Extract the from/to paths and binary flag from a single file segment. */
export function parseSegmentMeta(segment: string): { from: string; to: string; binary: boolean } {
  const lines = segment.split("\n");
  let from = "";
  let to = "";
  let binary = false;
  let sawMinus = false;
  let sawPlus = false;

  for (const line of lines) {
    if (line.startsWith("--- ")) {
      from = stripPathToken(line.slice(4));
      sawMinus = true;
    } else if (line.startsWith("+++ ")) {
      to = stripPathToken(line.slice(4));
      sawPlus = true;
    } else if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      binary = true;
    }
  }

  if (!sawMinus || !sawPlus) {
    const gitLine = lines.find((line) => line.startsWith("diff --git "));
    const parsed = gitLine === undefined ? null : parseGitHeader(gitLine);
    if (parsed !== null) {
      from = parsed.from;
      to = parsed.to;
    }
  }

  return { from, to, binary };
}

/** Count added/removed content lines in a file segment. */
export function countChanges(segment: string): { additions: number; deletions: number } {
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
}
