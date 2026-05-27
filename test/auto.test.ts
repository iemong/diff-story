import {
  EXIT_FAIL,
  EXIT_OK,
  FIRST,
  SIMPLE_DIFF,
  TWO_FILE_DIFF,
  makeIo,
  whichMissing,
} from "./helpers";
import { describe, expect, test } from "bun:test";
import type { AgentResult } from "../src/types";
import { main } from "../src/main";

const AGENT_JSON =
  '{"chapters":[{"title":"Auto","synopsis":"From the agent.","files":["src/b.ts","src/a.ts"]}]}';
const BIG_LINE_WIDTH = 50;
const BIG_LINE_COUNT = 3000;
const AGENT_FAIL_EXIT = 2;

const okAgent = (stdout: string) => (): Promise<AgentResult> =>
  Promise.resolve({ exitCode: EXIT_OK, stderr: "", stdout });

const makeBigDiff = (): string =>
  [
    "diff --git a/src/big.ts b/src/big.ts",
    "--- a/src/big.ts",
    "+++ b/src/big.ts",
    `@@ -0,0 +1,${BIG_LINE_COUNT} @@`,
    ...Array.from({ length: BIG_LINE_COUNT }, () => `+${"x".repeat(BIG_LINE_WIDTH)}`),
    "",
  ].join("\n");

describe("main — auto", () => {
  test("drives the agent and renders the story in one command", async () => {
    const io = makeIo({ runAgent: okAgent(AGENT_JSON), stdin: TWO_FILE_DIFF });
    expect(await main(["auto"], io)).toBe(EXIT_OK);
    expect(io.out).toContain("📖 Chapter 1/1 — Auto");
    expect(io.out.indexOf("src/b.ts")).toBeLessThan(io.out.indexOf("src/a.ts"));
    expect(io.err).toContain("running claude");
  });

  test("hands the diff to the agent on stdin", async () => {
    let received = "";
    const io = makeIo({
      runAgent: (_command: string, _args: string[], input: string) => {
        received = input;
        return Promise.resolve({ exitCode: EXIT_OK, stderr: "", stdout: AGENT_JSON });
      },
      stdin: SIMPLE_DIFF,
    });
    await main(["auto"], io);
    expect(received).toContain("diff --git a/src/a.ts");
  });

  test("tolerates an agent reply wrapped in prose and fences", async () => {
    const io = makeIo({
      runAgent: okAgent(`Sure:\n\`\`\`json\n${AGENT_JSON}\n\`\`\``),
      stdin: SIMPLE_DIFF,
    });
    expect(await main(["auto"], io)).toBe(EXIT_OK);
    expect(io.out).toContain("Chapter 1/1 — Auto");
  });

  test("--json emits structured output", async () => {
    const io = makeIo({ runAgent: okAgent(AGENT_JSON), stdin: SIMPLE_DIFF });
    await main(["auto", "--json"], io);
    expect(JSON.parse(io.out).chapters[FIRST].title).toBe("Auto");
  });

  test("--agent overrides detection even when nothing is on PATH", async () => {
    let cmd = "";
    const io = makeIo({
      runAgent: (command: string) => {
        cmd = command;
        return Promise.resolve({ exitCode: EXIT_OK, stderr: "", stdout: AGENT_JSON });
      },
      stdin: SIMPLE_DIFF,
      which: whichMissing,
    });
    expect(await main(["auto", "--agent", "mytool"], io)).toBe(EXIT_OK);
    expect(cmd).toBe("mytool");
  });

  test("DS_E020 when no agent is found", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF, which: whichMissing });
    expect(await main(["auto"], io)).toBe(EXIT_FAIL);
    expect(io.err).toContain("DS_E020");
  });

  test("DS_E021 surfaces the agent's stderr on a non-zero exit", async () => {
    const io = makeIo({
      runAgent: () => Promise.resolve({ exitCode: AGENT_FAIL_EXIT, stderr: "boom", stdout: "" }),
      stdin: SIMPLE_DIFF,
    });
    expect(await main(["auto"], io)).toBe(EXIT_FAIL);
    expect(io.err).toContain("DS_E021");
    expect(io.err).toContain("boom");
  });

  test("DS_E021 falls back to the exit code when stderr is empty", async () => {
    const io = makeIo({
      runAgent: () => Promise.resolve({ exitCode: AGENT_FAIL_EXIT, stderr: "", stdout: "" }),
      stdin: SIMPLE_DIFF,
    });
    expect(await main(["auto"], io)).toBe(EXIT_FAIL);
    expect(io.err).toContain(`exited with code ${AGENT_FAIL_EXIT}`);
  });

  test("warns on a very large prompt", async () => {
    const io = makeIo({ runAgent: okAgent(AGENT_JSON), stdin: makeBigDiff() });
    expect(await main(["auto"], io)).toBe(EXIT_OK);
    expect(io.err).toContain("large prompt");
  });

  test("DS_E011 when the agent returns no usable JSON", async () => {
    const io = makeIo({ stdin: SIMPLE_DIFF });
    expect(await main(["auto"], io)).toBe(EXIT_FAIL);
    expect(io.err).toContain("DS_E011");
  });
});
