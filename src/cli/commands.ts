import type { Chapter, DiffFile, Io } from "../types";
import { formatFilesJson, formatJson, formatStory } from "../formatter";
import { parseChaptersJson, reconcileChapters } from "../chapters";
import type { CliFlags } from "./args";
import { Errors } from "../errors";
import { buildPlan } from "../plan";
import { parseUnifiedDiff } from "../parser";

const OK = 0;

const readFiles = async (io: Io): Promise<DiffFile[]> => parseUnifiedDiff(await io.readStdin());

const readChaptersText = async (flags: CliFlags, io: Io): Promise<string> => {
  if (flags.chapters !== undefined) {
    return flags.chapters;
  }
  if (flags.chaptersJson === undefined) {
    throw Errors.missingChapters();
  }
  try {
    return await io.readFile(flags.chaptersJson);
  } catch (error) {
    let detail = String(error);
    if (error instanceof Error) {
      detail = error.message;
    }
    throw Errors.chaptersFileUnreadable(flags.chaptersJson, detail);
  }
};

const resolveChapters = async (flags: CliFlags, io: Io, files: DiffFile[]): Promise<Chapter[]> => {
  const text = await readChaptersText(flags, io);
  return reconcileChapters(parseChaptersJson(text), files);
};

/** Default command: emit the request the agent fulfils (the file plan). */
export const runPlan = async (io: Io): Promise<number> => {
  io.write(`${buildPlan(await readFiles(io))}\n`);
  return OK;
};

/** Parse the diff into structured files as JSON. */
export const runParse = async (io: Io): Promise<number> => {
  io.write(formatFilesJson(await readFiles(io)));
  return OK;
};

/** Re-emit the diff grouped under the chapters the agent supplies. */
export const runFormat = async (flags: CliFlags, io: Io): Promise<number> => {
  const files = await readFiles(io);
  const chapters = await resolveChapters(flags, io, files);
  let output = formatStory(files, chapters);
  if (flags.json) {
    output = formatJson(chapters, files);
  }
  io.write(output);
  return OK;
};
