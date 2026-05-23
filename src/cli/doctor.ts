import type { Io } from "../types";
import parseDiff from "parse-diff";

const EXPECTED_FILES = 1;
const OK = 0;
const FAIL = 1;

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

const SAMPLE_DIFF = [
  "diff --git a/sample.txt b/sample.txt",
  "index 0000000..1111111 100644",
  "--- a/sample.txt",
  "+++ b/sample.txt",
  "@@ -0,0 +1 @@",
  "+hello",
  "",
].join("\n");

/** Run the environment checks and return them plus an exit code. */
export const runDoctorChecks = async (io: Io): Promise<{ checks: DoctorCheck[]; code: number }> => {
  const parsedSample = parseDiff(SAMPLE_DIFF);
  const parseOk = parsedSample.length === EXPECTED_FILES;
  let parseDetail = "unexpected output";
  if (parseOk) {
    parseDetail = "working";
  }

  const gitPath = await io.which("git");
  const gitFound = typeof gitPath === "string";
  let gitDetail = "not found in PATH";
  if (typeof gitPath === "string") {
    gitDetail = gitPath;
  }

  const checks: DoctorCheck[] = [
    { detail: io.bunVersion, name: "Bun runtime", ok: true },
    { detail: parseDetail, name: "parse-diff", ok: parseOk },
    { detail: gitDetail, name: "git", ok: gitFound },
  ];

  let code = OK;
  if (!checks.every((check) => check.ok)) {
    code = FAIL;
  }
  return { checks, code };
};

/** Render the doctor checks as human-readable lines. */
export const renderDoctor = (checks: DoctorCheck[]): string => {
  const lines = checks.map((check) => {
    let mark = "✗";
    if (check.ok) {
      mark = "✓";
    }
    return `${mark} ${check.name}: ${check.detail}`;
  });
  return `${lines.join("\n")}\n`;
};
