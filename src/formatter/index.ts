import type { Chapter, DiffFile } from "../types";

const BAR = "═".repeat(60);
const SYNOPSIS_WIDTH = 72;

/** Greedy word-wrap. CJK text without spaces stays on one line. */
export function wordWrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/** Render a single chapter banner as a block of `#`-prefixed comment lines. */
export function renderBanner(index: number, total: number, chapter: Chapter): string {
  const synopsisLines = wordWrap(chapter.synopsis, SYNOPSIS_WIDTH).map((line, lineIndex) =>
    lineIndex === 0 ? `# Synopsis: ${line}` : `#           ${line}`,
  );
  return [
    `# ${BAR}`,
    `# 📖 Chapter ${index}/${total} — ${chapter.title}`,
    "#",
    ...synopsisLines,
    `# ${BAR}`,
  ].join("\n");
}

/** Re-emit the diff grouped into chapters, each preceded by a banner. */
export function formatStory(files: DiffFile[], chapters: Chapter[]): string {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const blocks: string[] = [];

  chapters.forEach((chapter, index) => {
    blocks.push(renderBanner(index + 1, chapters.length, chapter));
    for (const path of chapter.files) {
      const file = byPath.get(path);
      if (file !== undefined) {
        blocks.push(file.rawText.replace(/\s+$/, ""));
      }
    }
  });

  return `${blocks.join("\n\n")}\n`;
}

/** Serialize parsed files as JSON (the `parse` command output). */
export function formatFilesJson(files: DiffFile[]): string {
  return `${JSON.stringify({ files }, null, 2)}\n`;
}

/** Serialize the resolved story as JSON (the `format --json` output). */
export function formatJson(chapters: Chapter[], files: DiffFile[]): string {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const enriched = chapters.map((chapter) => ({
    title: chapter.title,
    synopsis: chapter.synopsis,
    files: chapter.files.map((path) => {
      const file = byPath.get(path);
      return {
        path,
        additions: file?.additions ?? 0,
        deletions: file?.deletions ?? 0,
        binary: file?.binary ?? false,
      };
    }),
  }));
  return `${JSON.stringify({ chapters: enriched }, null, 2)}\n`;
}
