import type { AgentResult, Io } from "./types";

/** Production wiring of every side effect. Excluded from coverage by design. */
export const realIo: Io = {
  bunVersion: Bun.version,
  readFile: (path: string): Promise<string> => Bun.file(path).text(),
  readStdin: (): Promise<string> => Bun.stdin.text(),
  runAgent: async (command: string, args: string[], input: string): Promise<AgentResult> => {
    const proc = Bun.spawn([command, ...args], {
      stderr: "pipe",
      stdin: new TextEncoder().encode(input),
      stdout: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { exitCode, stderr, stdout };
  },
  which: (command: string): Promise<string | undefined> =>
    Promise.resolve(Bun.which(command) ?? undefined),
  write: (text: string): void => {
    process.stdout.write(text);
  },
  writeError: (text: string): void => {
    process.stderr.write(text);
  },
};
