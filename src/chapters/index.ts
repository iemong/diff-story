import { Errors } from "../errors";
import type { Chapter, DiffFile } from "../types";

/** JSON Schema for the chapters an agent must produce and hand back to `format`. */
export const CHAPTERS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "diff-story chapters",
  type: "object",
  required: ["chapters"],
  properties: {
    chapters: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "synopsis", "files"],
        properties: {
          title: { type: "string" },
          synopsis: { type: "string" },
          files: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate that an unknown value is a well-formed array of chapters. */
export function validateChapterArray(value: unknown): Chapter[] {
  if (!Array.isArray(value)) {
    throw Errors.invalidChaptersJson("expected an array of chapters");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw Errors.invalidChaptersJson(`chapter ${index} is not an object`);
    }
    const { title, synopsis, files } = entry;
    if (typeof title !== "string") {
      throw Errors.invalidChaptersJson(`chapter ${index}: "title" must be a string`);
    }
    if (typeof synopsis !== "string") {
      throw Errors.invalidChaptersJson(`chapter ${index}: "synopsis" must be a string`);
    }
    if (!Array.isArray(files) || files.some((file) => typeof file !== "string")) {
      throw Errors.invalidChaptersJson(`chapter ${index}: "files" must be an array of strings`);
    }
    return { title, synopsis, files: files as string[] };
  });
}

/** Parse a chapters JSON string (a bare array or `{ chapters: [...] }`) into chapters. */
export function parseChaptersJson(text: string): Chapter[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw Errors.invalidChaptersJson(error instanceof Error ? error.message : String(error));
  }
  const candidate = Array.isArray(value) ? value : isRecord(value) ? value.chapters : undefined;
  return validateChapterArray(candidate);
}

/** Drop file references the diff does not contain, and chapters left empty. */
export function pruneUnknownFiles(chapters: Chapter[], files: DiffFile[]): Chapter[] {
  const known = new Set(files.map((file) => file.path));
  return chapters
    .map((chapter) => ({
      ...chapter,
      files: chapter.files.filter((path) => known.has(path)),
    }))
    .filter((chapter) => chapter.files.length > 0);
}

/** Append any files not assigned to a chapter as a trailing appendix. */
export function appendLeftovers(chapters: Chapter[], files: DiffFile[]): Chapter[] {
  const referenced = new Set(chapters.flatMap((chapter) => chapter.files));
  const leftovers = files.filter((file) => !referenced.has(file.path)).map((file) => file.path);
  if (leftovers.length === 0) {
    return chapters;
  }
  return [
    ...chapters,
    {
      title: "Appendix — unsorted changes",
      synopsis: "Files not assigned to a chapter.",
      files: leftovers,
    },
  ];
}

/** Normalize agent-supplied chapters against the diff: prune unknowns, append leftovers. */
export function reconcileChapters(chapters: Chapter[], files: DiffFile[]): Chapter[] {
  return appendLeftovers(pruneUnknownFiles(chapters, files), files);
}
