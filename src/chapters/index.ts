import type { Chapter, DiffFile, Risk } from "../types";
import { Errors } from "../errors";

const NO_FILES = 0;

const RISKS = new Set<string>(["high", "medium", "low"]);

/** JSON Schema for the chapters an agent must produce and hand back to `format`. */
export const CHAPTERS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  properties: {
    chapters: {
      items: {
        properties: {
          checklist: { items: { type: "string" }, type: "array" },
          files: { items: { type: "string" }, type: "array" },
          risk: { enum: ["high", "medium", "low"], type: "string" },
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

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const validateRisk = (value: unknown, index: number): Risk | undefined => {
  if (value !== undefined && (typeof value !== "string" || !RISKS.has(value))) {
    throw Errors.invalidChaptersJson(`chapter ${index}: "risk" must be high, medium, or low`);
  }
  return value as Risk | undefined;
};

const validateChecklist = (value: unknown, index: number): string[] | undefined => {
  if (value !== undefined && !isStringArray(value)) {
    throw Errors.invalidChaptersJson(`chapter ${index}: "checklist" must be an array of strings`);
  }
  return value as string[] | undefined;
};

const validateChapter = (entry: unknown, index: number): Chapter => {
  if (!isRecord(entry)) {
    throw Errors.invalidChaptersJson(`chapter ${index} is not an object`);
  }
  const { title, synopsis, files, risk, checklist } = entry;
  if (typeof title !== "string") {
    throw Errors.invalidChaptersJson(`chapter ${index}: "title" must be a string`);
  }
  if (typeof synopsis !== "string") {
    throw Errors.invalidChaptersJson(`chapter ${index}: "synopsis" must be a string`);
  }
  if (!isStringArray(files)) {
    throw Errors.invalidChaptersJson(`chapter ${index}: "files" must be an array of strings`);
  }
  const chapter: Chapter = { files, synopsis, title };
  const validRisk = validateRisk(risk, index);
  if (validRisk !== undefined) {
    chapter.risk = validRisk;
  }
  const validChecklist = validateChecklist(checklist, index);
  if (validChecklist !== undefined) {
    chapter.checklist = validChecklist;
  }
  return chapter;
};

/** Validate that an unknown value is a well-formed array of chapters. */
export const validateChapterArray = (value: unknown): Chapter[] => {
  if (!Array.isArray(value)) {
    throw Errors.invalidChaptersJson("expected an array of chapters");
  }
  return value.map((entry, index) => validateChapter(entry, index));
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
      risk: "low",
      synopsis: "Files not assigned to a chapter.",
      title: "Appendix — unsorted changes",
    },
  ];
};

/** Normalize agent-supplied chapters against the diff: prune unknowns, append leftovers. */
export const reconcileChapters = (chapters: Chapter[], files: DiffFile[]): Chapter[] =>
  appendLeftovers(pruneUnknownFiles(chapters, files), files);
