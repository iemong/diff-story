import type { Chapter, DiffFile, Note, Risk } from "../types";
import { type NoiseKind, classifyNoise } from "../noise";
import { renderWithNotes } from "../notes";

const BAR_WIDTH = 60;
const SYNOPSIS_WIDTH = 72;
const JSON_INDENT = 2;
const ZERO = 0;
const ONE = 1;

const BAR = "═".repeat(BAR_WIDTH);

/** Greedy word-wrap. CJK text without spaces stays on one line. */
export const wordWrap = (text: string, width: number): string[] => {
  const words = text.split(/\s+/u).filter((word) => word.length > ZERO);
  if (words.length === ZERO) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if (current.length + ONE + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
};

/** Render a single chapter banner as a block of `#`-prefixed comment lines. */
export const renderBanner = (index: number, total: number, chapter: Chapter): string => {
  const synopsisLines = wordWrap(chapter.synopsis, SYNOPSIS_WIDTH).map((line, lineIndex) => {
    if (lineIndex === ZERO) {
      return `# Synopsis: ${line}`;
    }
    return `#           ${line}`;
  });
  let header = `# 📖 Chapter ${index}/${total} — ${chapter.title}`;
  if (chapter.risk !== undefined) {
    header += `  [risk: ${chapter.risk}]`;
  }
  const lines = [`# ${BAR}`, header, "#", ...synopsisLines];
  if (chapter.checklist !== undefined && chapter.checklist.length > ZERO) {
    lines.push("#", "# Checklist:");
    for (const item of chapter.checklist) {
      lines.push(`#   □ ${item}`);
    }
  }
  lines.push(`# ${BAR}`);
  return lines.join("\n");
};

/** Collapse a noisy file to a single `#` summary line instead of its full diff. */
const renderFoldedFile = (file: DiffFile, kind: NoiseKind): string =>
  `# ── ${file.path} (${kind}) +${file.additions} -${file.deletions} · folded; omit --fold for the full diff`;

const renderFileBlock = (file: DiffFile, fold: boolean, notes: Note[]): string => {
  if (fold) {
    const kind = classifyNoise(file);
    if (kind !== undefined) {
      return renderFoldedFile(file, kind);
    }
  }
  return renderWithNotes(file.rawText, notes);
};

const groupNotesByPath = (notes: Note[]): Map<string, Note[]> => {
  const byPath = new Map<string, Note[]>();
  for (const note of notes) {
    const list = byPath.get(note.file);
    if (list === undefined) {
      byPath.set(note.file, [note]);
    } else {
      list.push(note);
    }
  }
  return byPath;
};

/** Options for rendering a story: fold low-signal files, attach inline notes. */
export interface StoryOptions {
  fold?: boolean;
  notes?: Note[];
}

/**
 * Re-emit the diff grouped into chapters, each preceded by a banner. With
 * `fold`, low-signal files (lockfiles, generated output, renames, binaries)
 * collapse to a one-line summary; without it every diff stays verbatim. Inline
 * `notes` are inserted right after the line they anchor to.
 */
export const formatStory = (
  files: DiffFile[],
  chapters: Chapter[],
  options: StoryOptions = {},
): string => {
  const fold = options.fold ?? false;
  const notesByPath = groupNotesByPath(options.notes ?? []);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const blocks: string[] = [];

  chapters.forEach((chapter, index) => {
    blocks.push(renderBanner(index + ONE, chapters.length, chapter));
    for (const path of chapter.files) {
      const file = byPath.get(path);
      if (file !== undefined) {
        blocks.push(renderFileBlock(file, fold, notesByPath.get(path) ?? []));
      }
    }
  });

  return `${blocks.join("\n\n")}\n`;
};

/** Serialize parsed files as JSON (the `parse` command output). */
export const formatFilesJson = (files: DiffFile[]): string =>
  `${JSON.stringify({ files }, undefined, JSON_INDENT)}\n`;

interface EnrichedFile {
  additions: number;
  binary: boolean;
  deletions: number;
  path: string;
  noise?: NoiseKind;
}

const enrichFile = (file: DiffFile | undefined, path: string): EnrichedFile => {
  const entry: EnrichedFile = {
    additions: file?.additions ?? ZERO,
    binary: file?.binary ?? false,
    deletions: file?.deletions ?? ZERO,
    path,
  };
  if (file !== undefined) {
    const kind = classifyNoise(file);
    if (kind !== undefined) {
      entry.noise = kind;
    }
  }
  return entry;
};

interface EnrichedChapter {
  title: string;
  synopsis: string;
  files: EnrichedFile[];
  risk?: Risk;
  checklist?: string[];
}

const enrichChapter = (chapter: Chapter, byPath: Map<string, DiffFile>): EnrichedChapter => {
  const entry: EnrichedChapter = {
    files: chapter.files.map((path) => enrichFile(byPath.get(path), path)),
    synopsis: chapter.synopsis,
    title: chapter.title,
  };
  if (chapter.risk !== undefined) {
    entry.risk = chapter.risk;
  }
  if (chapter.checklist !== undefined) {
    entry.checklist = chapter.checklist;
  }
  return entry;
};

interface Story {
  chapters: EnrichedChapter[];
  notes?: Note[];
}

/** Serialize the resolved story as JSON (the `format --json` output). */
export const formatJson = (chapters: Chapter[], files: DiffFile[], notes: Note[] = []): string => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const story: Story = { chapters: chapters.map((chapter) => enrichChapter(chapter, byPath)) };
  if (notes.length > ZERO) {
    story.notes = notes;
  }
  return `${JSON.stringify(story, undefined, JSON_INDENT)}\n`;
};
