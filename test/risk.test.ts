import type { Chapter, DiffFile } from "../src/types";
import { describe, expect, test } from "bun:test";
import { effectiveRisk, orderByRisk } from "../src/risk";

const HIGH_CHURN_ADDS = 120;
const MED_CHURN_ADDS = 30;
const LOW_CHURN_ADDS = 2;

const file = (path: string, additions: number): DiffFile => ({
  additions,
  binary: false,
  deletions: 0,
  from: path,
  path,
  rawText: "",
  to: path,
});

const chapter = (title: string, files: string[], risk?: Chapter["risk"]): Chapter => {
  const base: Chapter = { files, synopsis: "s", title };
  if (risk !== undefined) {
    base.risk = risk;
  }
  return base;
};

describe("effectiveRisk", () => {
  test("uses the agent's label when present", () => {
    expect(effectiveRisk(chapter("c", ["a.ts"], "low"), [file("a.ts", HIGH_CHURN_ADDS)])).toBe(
      "low",
    );
  });

  test("derives high risk from a security-sensitive path", () => {
    expect(
      effectiveRisk(chapter("c", ["src/auth/login.ts"]), [
        file("src/auth/login.ts", LOW_CHURN_ADDS),
      ]),
    ).toBe("high");
  });

  test("derives high risk from large churn", () => {
    expect(effectiveRisk(chapter("c", ["big.ts"]), [file("big.ts", HIGH_CHURN_ADDS)])).toBe("high");
  });

  test("derives medium risk from moderate churn", () => {
    expect(effectiveRisk(chapter("c", ["mid.ts"]), [file("mid.ts", MED_CHURN_ADDS)])).toBe(
      "medium",
    );
  });

  test("derives low risk from a small, non-sensitive change", () => {
    expect(effectiveRisk(chapter("c", ["small.ts"]), [file("small.ts", LOW_CHURN_ADDS)])).toBe(
      "low",
    );
  });

  test("ignores files missing from the diff when summing churn", () => {
    expect(effectiveRisk(chapter("c", ["ghost.ts"]), [])).toBe("low");
  });
});

describe("orderByRisk", () => {
  test("sorts riskiest chapters first", () => {
    const files = [file("a.ts", LOW_CHURN_ADDS), file("b.ts", LOW_CHURN_ADDS)];
    const chapters = [chapter("Low", ["a.ts"], "low"), chapter("High", ["b.ts"], "high")];
    expect(orderByRisk(chapters, files).map((ch) => ch.title)).toEqual(["High", "Low"]);
  });

  test("breaks ties on churn, then on the original order", () => {
    const files = [
      file("a.ts", LOW_CHURN_ADDS),
      file("b.ts", MED_CHURN_ADDS),
      file("c.ts", LOW_CHURN_ADDS),
    ];
    const chapters = [
      chapter("First", ["a.ts"], "medium"),
      chapter("Churny", ["b.ts"], "medium"),
      chapter("Last", ["c.ts"], "medium"),
    ];
    expect(orderByRisk(chapters, files).map((ch) => ch.title)).toEqual(["Churny", "First", "Last"]);
  });
});
