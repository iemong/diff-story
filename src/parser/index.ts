import { countChanges, parseSegmentMeta, splitDiffIntoFiles } from "./split";
import type { DiffFile } from "../types";
import { Errors } from "../errors";
import parseDiff from "parse-diff";

const NO_FILES = 0;

/**
 * Parse a unified diff into structured files.
 *
 * `parse-diff` acts as the validity gate (the ecosystem-standard parser), while
 * our own splitter preserves each file's verbatim text so the diff can be
 * re-emitted faithfully after reordering.
 */
export const parseUnifiedDiff = (raw: string): DiffFile[] => {
  if (raw.trim() === "") {
    throw Errors.emptyInput();
  }

  if (parseDiff(raw).length === NO_FILES) {
    throw Errors.noDiffFound();
  }

  return splitDiffIntoFiles(raw).map((rawText) => {
    const { from, to, binary } = parseSegmentMeta(rawText);
    const { additions, deletions } = countChanges(rawText);
    let path = from;
    if (to !== "" && to !== "/dev/null") {
      path = to;
    }
    return { additions, binary, deletions, from, path, rawText, to };
  });
};
