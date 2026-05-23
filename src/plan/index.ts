import type { DiffFile } from "../types";

const ONE_BASED = 1;

/** The chapters JSON shape the agent must produce, shown inline in the plan. */
export const CHAPTERS_SHAPE =
  '{"chapters":[{"title":"...","synopsis":"...","files":["path", ...]}]}';

/** Render the changed files as a numbered manifest with their +/- counts. */
export const buildManifest = (files: DiffFile[]): string =>
  files
    .map((file, index) => {
      let meta = `+${file.additions} -${file.deletions}`;
      if (file.binary) {
        meta += ", binary";
      }
      return `${index + ONE_BASED}. ${file.path} (${meta})`;
    })
    .join("\n");

/**
 * Build the request the calling agent fulfils: group the files into an ordered
 * narrative of chapters, then hand them back to `diff-story format`.
 *
 * diff-story does not call a model itself — the agent driving it is the
 * intelligence. This keeps the tool a deterministic, dependency-light filter.
 */
export const buildPlan = (files: DiffFile[]): string =>
  [
    `Group the ${files.length} changed files below into an ordered sequence of chapters`,
    "that reads as a narrative: earlier chapters set up the context later ones build on.",
    "Then render the story by piping the same diff to:",
    "",
    "    diff-story format --chapters '<json>'",
    "",
    `where <json> is ${CHAPTERS_SHAPE}, for example:`,
    "",
    '    {"chapters":[{"title":"API contract","synopsis":"Adds the shared types.","files":["src/api/types.ts"]}]}',
    "",
    "Rules: use each file path below exactly once, copied verbatim; keep each",
    "synopsis to one or two sentences; order chapters as a reading sequence.",
    "",
    `Files (${files.length}):`,
    buildManifest(files),
  ].join("\n");
