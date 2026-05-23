import type { Chapter, DiffFile } from "../types";
import { Errors } from "../errors";

const NO_FILES = 0;

/** JSON Schema for the chapters an agent must produce and hand back to `format`. */
export const CHAPTERS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  properties: {
    chapters: {
      items: {
        properties: {
          files: { items: { type: "string" }, type: "array" },
          synopsis: { type: "string" },
          title: { type: "string" },
        },
        required: ["title", "synopsis", "files"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["chapters"],
  title: "diff-story chapters",
  type: "object",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validate that an unknown value is a well-formed array of chapters. */
export const validateChapterArray = (value: unknown): Chapter[] => {
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
    return { files: files as string[], synopsis, title };
  });
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    let detail = String(error);
    if (error instanceof Error) {
      detail = error.message;
    }
    throw Errors.invalidChaptersJson(detail);
  }
};

const extractChapters = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value)) {
    return value.chapters;
  }
  return undefined;
};

/** Parse a chapters JSON string (a bare array or `{ chapters: [...] }`) into chapters. */
export const parseChaptersJson = (text: string): Chapter[] =>
  validateChapterArray(extractChapters(parseJson(text)));

/** Drop file references the diff does not contain, and chapters left empty. */
export const pruneUnknownFiles = (chapters: Chapter[], files: DiffFile[]): Chapter[] => {
  const known = new Set(files.map((file) => file.path));
  return chapters
    .map((chapter) => ({
      ...chapter,
      files: chapter.files.filter((path) => known.has(path)),
    }))
    .filter((chapter) => chapter.files.length > NO_FILES);
};

/** Append any files not assigned to a chapter as a trailing appendix. */
export const appendLeftovers = (chapters: Chapter[], files: DiffFile[]): Chapter[] => {
  const referenced = new Set(chapters.flatMap((chapter) => chapter.files));
  const leftovers = files.filter((file) => !referenced.has(file.path)).map((file) => file.path);
  if (leftovers.length === NO_FILES) {
    return chapters;
  }
  return [
    ...chapters,
    {
      files: leftovers,
      synopsis: "Files not assigned to a chapter.",
      title: "Appendix — unsorted changes",
    },
  ];
};

/** Normalize agent-supplied chapters against the diff: prune unknowns, append leftovers. */
export const reconcileChapters = (chapters: Chapter[], files: DiffFile[]): Chapter[] =>
  appendLeftovers(pruneUnknownFiles(chapters, files), files);
