import type { Chapter, DiffFile } from "../types";

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
  return [
    `# ${BAR}`,
    `# 📖 Chapter ${index}/${total} — ${chapter.title}`,
    "#",
    ...synopsisLines,
    `# ${BAR}`,
  ].join("\n");
};

/** Re-emit the diff grouped into chapters, each preceded by a banner. */
export const formatStory = (files: DiffFile[], chapters: Chapter[]): string => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const blocks: string[] = [];

  chapters.forEach((chapter, index) => {
    blocks.push(renderBanner(index + ONE, chapters.length, chapter));
    for (const path of chapter.files) {
      const file = byPath.get(path);
      if (file !== undefined) {
        blocks.push(file.rawText.replace(/\s+$/u, ""));
      }
    }
  });

  return `${blocks.join("\n\n")}\n`;
};

/** Serialize parsed files as JSON (the `parse` command output). */
export const formatFilesJson = (files: DiffFile[]): string =>
  `${JSON.stringify({ files }, undefined, JSON_INDENT)}\n`;

/** Serialize the resolved story as JSON (the `format --json` output). */
export const formatJson = (chapters: Chapter[], files: DiffFile[]): string => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const enriched = chapters.map((chapter) => ({
    files: chapter.files.map((path) => {
      const file = byPath.get(path);
      return {
        additions: file?.additions ?? ZERO,
        binary: file?.binary ?? false,
        deletions: file?.deletions ?? ZERO,
        path,
      };
    }),
    synopsis: chapter.synopsis,
    title: chapter.title,
  }));
  return `${JSON.stringify({ chapters: enriched }, undefined, JSON_INDENT)}\n`;
};
