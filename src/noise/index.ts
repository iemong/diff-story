import type { DiffFile } from "../types";

const ZERO = 0;
const LAST = -1;

/**
 * What kind of low-signal change a file is, if any — used to fold it behind a
 * one-line summary under `--fold`.
 *
 * Detection is deliberately conservative: only changes almost everyone skims
 * past. There is no config/override (by design) — `--fold` is all-or-nothing,
 * so omitting it expands everything. The full rule set:
 *
 *   rename     pure rename/move, no content change (additions + deletions = 0)
 *   lockfile   a dependency lock file (exact basename in LOCKFILES)
 *   generated  under dist/ build/ vendor/ node_modules/, or a known generated
 *              suffix (.min.js .min.css .map .pb.go _pb2.py)
 *   binary     a binary patch (no textual diff to read)
 *
 * Checked in that order, so a renamed lock file reads as "rename" and a binary
 * inside dist/ reads as "generated".
 */
export type NoiseKind = "lockfile" | "generated" | "binary" | "rename";

const LOCKFILES = new Set([
  "Cargo.lock",
  "Gemfile.lock",
  "Pipfile.lock",
  "Podfile.lock",
  "bun.lock",
  "bun.lockb",
  "composer.lock",
  "flake.lock",
  "go.sum",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock",
]);

const GENERATED_DIRS = ["dist", "build", "vendor", "node_modules"];
const GENERATED_SUFFIXES = [".min.js", ".min.css", ".map", ".pb.go", "_pb2.py"];

const basename = (path: string): string => path.split("/").at(LAST) ?? path;

const isGenerated = (path: string): boolean => {
  const segments = path.split("/");
  if (GENERATED_DIRS.some((dir) => segments.includes(dir))) {
    return true;
  }
  return GENERATED_SUFFIXES.some((suffix) => path.endsWith(suffix));
};

/** Classify a file as a kind of low-signal "noise", or undefined when it is signal. */
export const classifyNoise = (file: DiffFile): NoiseKind | undefined => {
  if (file.from !== file.to && file.additions === ZERO && file.deletions === ZERO) {
    return "rename";
  }
  if (LOCKFILES.has(basename(file.path))) {
    return "lockfile";
  }
  if (isGenerated(file.path)) {
    return "generated";
  }
  if (file.binary) {
    return "binary";
  }
  return undefined;
};
