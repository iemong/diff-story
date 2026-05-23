import parseDiff from "parse-diff";
import type { Io } from "../types";

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
export async function runDoctorChecks(io: Io): Promise<{ checks: DoctorCheck[]; code: number }> {
  const checks: DoctorCheck[] = [];

  const apiKey = io.env.ANTHROPIC_API_KEY;
  const hasApiKey = apiKey !== undefined && apiKey !== "";
  checks.push({
    name: "ANTHROPIC_API_KEY",
    ok: hasApiKey,
    detail: hasApiKey ? "set" : "not set",
  });

  checks.push({ name: "Bun runtime", ok: true, detail: io.bunVersion });

  const parsedSample = parseDiff(SAMPLE_DIFF);
  checks.push({
    name: "parse-diff",
    ok: parsedSample.length === 1,
    detail: parsedSample.length === 1 ? "working" : "unexpected output",
  });

  const gitPath = await io.which("git");
  checks.push({
    name: "git",
    ok: gitPath !== null,
    detail: gitPath !== null ? gitPath : "not found in PATH",
  });

  const code = checks.every((check) => check.ok) ? 0 : 1;
  return { checks, code };
}

/** Render the doctor checks as human-readable lines. */
export function renderDoctor(checks: DoctorCheck[]): string {
  return `${checks.map((check) => `${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`).join("\n")}\n`;
}
