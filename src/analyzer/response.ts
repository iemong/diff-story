import { DiffStoryError, Errors } from "../errors";
import type { Chapter, DiffFile } from "../types";
import { appendLeftovers, pruneUnknownFiles, validateChapterArray } from "./chapters";

/** Extract a JSON value from a model response that may wrap it in prose or fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced === null ? text : fenced[1]).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to slicing the first {...} span out of surrounding prose.
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // Fall through to the error below.
    }
  }

  throw Errors.invalidLlmResponse("could not parse JSON from the model response");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse a model response into normalized, file-validated chapters. */
export function parseChapterResponse(text: string, files: DiffFile[]): Chapter[] {
  const value = extractJson(text);
  if (!isRecord(value) || !Array.isArray(value.chapters)) {
    throw Errors.invalidLlmResponse('response JSON must have a "chapters" array');
  }

  let chapters: Chapter[];
  try {
    chapters = validateChapterArray(value.chapters);
  } catch (error) {
    const detail = error instanceof DiffStoryError ? error.why : String(error);
    throw Errors.invalidLlmResponse(detail);
  }

  return appendLeftovers(pruneUnknownFiles(chapters, files), files);
}
