import parseDiff from "parse-diff";
import { Errors } from "../errors";
import type { DiffFile } from "../types";
import { countChanges, parseSegmentMeta, splitDiffIntoFiles } from "./split";

/**
 * Parse a unified diff into structured files.
 *
 * `parse-diff` acts as the validity gate (the ecosystem-standard parser), while
 * our own splitter preserves each file's verbatim text so the diff can be
 * re-emitted faithfully after reordering.
 */
export function parseUnifiedDiff(raw: string): DiffFile[] {
  if (raw.trim() === "") {
    throw Errors.emptyInput();
  }

  if (parseDiff(raw).length === 0) {
    throw Errors.noDiffFound();
  }

  return splitDiffIntoFiles(raw).map((rawText) => {
    const { from, to, binary } = parseSegmentMeta(rawText);
    const { additions, deletions } = countChanges(rawText);
    const path = to !== "" && to !== "/dev/null" ? to : from;
    return { from, to, path, additions, deletions, binary, rawText };
  });
}
