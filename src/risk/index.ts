import type { Chapter, DiffFile, Risk } from "../types";

const ZERO = 0;
const HIGH_CHURN = 100;
const MED_CHURN = 20;

/** Reading weight per risk level — higher reads first under `--order risk`. */
const WEIGHT: Record<Risk, number> = { high: 3, low: 1, medium: 2 };

/**
 * Path fragments that mark security-sensitive code. A chapter touching one is
 * treated as high risk when the agent did not label it — over-flagging risk is
 * safe here because it only affects reading order, never what is shown.
 */
const SENSITIVE = [
  ".env",
  "auth",
  "crypto",
  "login",
  "password",
  "permission",
  "secret",
  "security",
  "session",
  "token",
];

const churnOf = (chapter: Chapter, byPath: Map<string, DiffFile>): number => {
  let total = ZERO;
  for (const path of chapter.files) {
    const file = byPath.get(path);
    if (file !== undefined) {
      total += file.additions + file.deletions;
    }
  }
  return total;
};

const touchesSensitive = (chapter: Chapter): boolean =>
  chapter.files.some((path) => SENSITIVE.some((needle) => path.toLowerCase().includes(needle)));

/** Estimate a chapter's risk from deterministic signals (sensitive paths, churn). */
const deriveRisk = (chapter: Chapter, churn: number): Risk => {
  if (touchesSensitive(chapter) || churn >= HIGH_CHURN) {
    return "high";
  }
  if (churn >= MED_CHURN) {
    return "medium";
  }
  return "low";
};

/** The risk used for ordering: the agent's label, else a deterministic estimate. */
export const effectiveRisk = (chapter: Chapter, files: DiffFile[]): Risk => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  return chapter.risk ?? deriveRisk(chapter, churnOf(chapter, byPath));
};

/**
 * Reorder chapters riskiest-first so a reviewer reads the dangerous changes
 * while fresh. Ties break on churn, then on the original (narrative) order, so
 * the sort is stable and deterministic.
 */
export const orderByRisk = (chapters: Chapter[], files: DiffFile[]): Chapter[] => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  return chapters
    .map((chapter, index) => {
      const churn = churnOf(chapter, byPath);
      const risk = chapter.risk ?? deriveRisk(chapter, churn);
      return { chapter, churn, index, weight: WEIGHT[risk] };
    })
    .toSorted(
      (left, right) =>
        right.weight - left.weight || right.churn - left.churn || left.index - right.index,
    )
    .map((scored) => scored.chapter);
};
