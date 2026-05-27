import type { DiffFile, Note } from "../types";

const FIRST = 0;
const ONE = 1;

/** Matches a hunk header, capturing the new-file (post-image) start line. */
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u;

/**
 * The set of new-file line numbers a single file's diff actually shows —
 * every added (`+`) or context (` `) line. Notes can only anchor to these;
 * a `line` outside the set is a hallucination and gets dropped.
 */
export const anchorableLines = (rawText: string): Set<number> => {
  const lines = new Set<number>();
  let current = FIRST;
  let inHunk = false;
  for (const line of rawText.split("\n")) {
    const header = HUNK.exec(line);
    if (header !== null) {
      current = Number(header[ONE]);
      inHunk = true;
    } else if (inHunk && (line.startsWith("+") || line.startsWith(" "))) {
      lines.add(current);
      current += ONE;
    }
  }
  return lines;
};

/** Keep only notes that anchor to a real changed/context line of a known file. */
export const anchorNotes = (notes: Note[], files: DiffFile[]): Note[] => {
  const linesByPath = new Map(files.map((file) => [file.path, anchorableLines(file.rawText)]));
  return notes.filter((note) => linesByPath.get(note.file)?.has(note.line) === true);
};

/** Render one note as a single `#` comment line, flattening any newlines. */
export const renderNoteLine = (note: Note): string =>
  `# 💬 [${note.kind}] ${note.body.replaceAll("\n", " ")}`;

/**
 * Re-emit a file's diff with each note inserted right after the line it
 * anchors to (matched by new-file line number). Trailing whitespace is
 * trimmed so the block joins cleanly with its neighbors.
 */
export const renderWithNotes = (rawText: string, notes: Note[]): string => {
  const byLine = new Map<number, Note[]>();
  for (const note of notes) {
    const list = byLine.get(note.line);
    if (list === undefined) {
      byLine.set(note.line, [note]);
    } else {
      list.push(note);
    }
  }

  const out: string[] = [];
  let current = FIRST;
  let inHunk = false;
  for (const line of rawText.split("\n")) {
    const header = HUNK.exec(line);
    out.push(line);
    if (header === null) {
      if (inHunk && (line.startsWith("+") || line.startsWith(" "))) {
        for (const note of byLine.get(current) ?? []) {
          out.push(renderNoteLine(note));
        }
        current += ONE;
      }
    } else {
      current = Number(header[ONE]);
      inHunk = true;
    }
  }
  return out.join("\n").replace(/\s+$/u, "");
};
