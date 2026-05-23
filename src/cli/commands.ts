import { parseChaptersJson, reconcileChapters } from "../chapters";
import { Errors } from "../errors";
import { formatFilesJson, formatJson, formatStory } from "../formatter";
import { parseUnifiedDiff } from "../parser";
import { buildPlan } from "../plan";
import type { Chapter, DiffFile, Io } from "../types";
import type { CliFlags } from "./args";

async function readFiles(io: Io): Promise<DiffFile[]> {
  return parseUnifiedDiff(await io.readStdin());
}

async function resolveChapters(flags: CliFlags, io: Io, files: DiffFile[]): Promise<Chapter[]> {
  let text: string;
  if (flags.chapters !== undefined) {
    text = flags.chapters;
  } else if (flags.chaptersJson !== undefined) {
    try {
      text = await io.readFile(flags.chaptersJson);
    } catch (error) {
      throw Errors.chaptersFileUnreadable(
        flags.chaptersJson,
        error instanceof Error ? error.message : String(error),
      );
    }
  } else {
    throw Errors.missingChapters();
  }
  return reconcileChapters(parseChaptersJson(text), files);
}

/** Default command: emit the request the agent fulfils (the file plan). */
export async function runPlan(io: Io): Promise<number> {
  io.write(`${buildPlan(await readFiles(io))}\n`);
  return 0;
}

/** Parse the diff into structured files as JSON. */
export async function runParse(io: Io): Promise<number> {
  io.write(formatFilesJson(await readFiles(io)));
  return 0;
}

/** Re-emit the diff grouped under the chapters the agent supplies. */
export async function runFormat(flags: CliFlags, io: Io): Promise<number> {
  const files = await readFiles(io);
  const chapters = await resolveChapters(flags, io, files);
  io.write(flags.json ? formatJson(chapters, files) : formatStory(files, chapters));
  return 0;
}
