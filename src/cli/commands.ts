import type { Chapter, DiffFile, Io } from "../types";
import { buildAutoPrompt, detectAgent, extractJsonText } from "../agent";
import { formatFilesJson, formatJson, formatStory } from "../formatter";
import { parseChaptersJson, reconcileChapters } from "../chapters";
import type { CliFlags } from "./args";
import { Errors } from "../errors";
import { buildPlan } from "../plan";
import { orderByRisk } from "../risk";
import { parseUnifiedDiff } from "../parser";

const OK = 0;
const WARN_PROMPT_BYTES = 100_000;

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

const renderStory = (flags: CliFlags, files: DiffFile[], chapters: Chapter[]): string => {
  let ordered = chapters;
  if (flags.order === "risk") {
    ordered = orderByRisk(chapters, files);
  }
  if (flags.json) {
    return formatJson(ordered, files);
  }
  return formatStory(files, ordered, flags.fold);
};

/** Re-emit the diff grouped under the chapters the agent supplies. */
export const runFormat = async (flags: CliFlags, io: Io): Promise<number> => {
  const files = await readFiles(io);
  const chapters = await resolveChapters(flags, io, files);
  io.write(renderStory(flags, files, chapters));
  return OK;
};

/**
 * `auto`: drive the whole protocol in one command. Detect the user's agent CLI,
 * hand it the diff, and render the chapters it returns. diff-story stays a
 * deterministic filter — the spawned agent is the intelligence.
 */
export const runAuto = async (flags: CliFlags, io: Io): Promise<number> => {
  const raw = await io.readStdin();
  const files = parseUnifiedDiff(raw);
  const agent = await detectAgent(io, flags.agent);
  const prompt = buildAutoPrompt(files, raw);
  io.writeError(`diff-story: running ${agent.command}… (this can take a while)\n`);
  if (prompt.length > WARN_PROMPT_BYTES) {
    io.writeError(`diff-story: large prompt (${prompt.length} bytes); the agent may truncate it\n`);
  }
  const result = await io.runAgent(agent.command, agent.args, prompt);
  if (result.exitCode !== OK) {
    throw Errors.agentFailed(
      agent.command,
      result.stderr.trim() || `exited with code ${result.exitCode}`,
    );
  }
  const chapters = reconcileChapters(parseChaptersJson(extractJsonText(result.stdout)), files);
  io.write(renderStory(flags, files, chapters));
  return OK;
};
