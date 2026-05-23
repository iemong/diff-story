import type { DiffFile } from "../types";

export const SYSTEM_PROMPT = [
  "You are diff-story, a tool that turns a pull-request diff into a readable narrative.",
  "Given the changed files, group them into an ordered sequence of chapters so that",
  "reading the chapters top to bottom tells the story of the change: earlier chapters",
  "establish context that later chapters build on. Be concise and concrete.",
].join(" ");

/** Maximum characters of any single file's diff included in the prompt. */
export const MAX_DIFF_CHARS = 6000;

/** Truncate an over-long file diff so the prompt stays within budget. */
export function truncateDiff(text: string, max: number = MAX_DIFF_CHARS): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n… (truncated ${text.length - max} chars)`;
}

/** Build the user prompt: a manifest of files with their (truncated) diffs. */
export function buildUserPrompt(files: DiffFile[]): string {
  const blocks = files.map((file, index) => {
    const meta = `+${file.additions} -${file.deletions}${file.binary ? ", binary" : ""}`;
    return `## File ${index + 1}: ${file.path} (${meta})\n\`\`\`diff\n${truncateDiff(file.rawText)}\n\`\`\``;
  });

  return [
    `There are ${files.length} changed files in this diff. Group them into an ordered sequence of chapters that reads like a narrative of the change.`,
    "",
    "Files:",
    ...blocks,
    "",
    'Respond ONLY with JSON shaped like {"chapters":[{"title":"...","synopsis":"...","files":["path",...]}]}.',
    "Reference each file path exactly once, copied verbatim from the headings above.",
    "Order chapters so an earlier chapter motivates a later one. Keep each synopsis to one or two sentences.",
  ].join("\n");
}
