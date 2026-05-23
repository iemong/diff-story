import type { AnalysisResult, Chapter, DiffFile } from "../types";

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

/** JSON Schema describing the `--json` output. */
export const OUTPUT_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "diff-story output",
  type: "object",
  required: ["chapters", "stats"],
  properties: {
    chapters: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "synopsis", "files"],
        properties: {
          title: { type: "string" },
          synopsis: { type: "string" },
          files: {
            type: "array",
            items: {
              type: "object",
              required: ["path", "additions", "deletions", "binary"],
              properties: {
                path: { type: "string" },
                additions: { type: "integer" },
                deletions: { type: "integer" },
                binary: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    stats: {
      type: "object",
      required: ["inputTokens", "outputTokens", "durationMs", "model"],
      properties: {
        inputTokens: { type: "integer" },
        outputTokens: { type: "integer" },
        durationMs: { type: "integer" },
        model: { type: "string" },
      },
    },
  },
} as const;

/** Serialize parsed files as JSON (the `parse` command output). */
export function formatFilesJson(files: DiffFile[]): string {
  return `${JSON.stringify({ files }, null, 2)}\n`;
}

/** Serialize an analysis result as JSON (the `--json` / `analyze` output). */
export function formatJson(result: AnalysisResult, files: DiffFile[]): string {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const chapters = result.chapters.map((chapter) => ({
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
  return `${JSON.stringify({ chapters, stats: result.stats }, null, 2)}\n`;
}

/** Serialize the output JSON Schema (the `--json-schema` output). */
export function formatSchema(): string {
  return `${JSON.stringify(OUTPUT_JSON_SCHEMA, null, 2)}\n`;
}
