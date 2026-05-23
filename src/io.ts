import type { Io } from "./types";

/** Production wiring of every side effect. Excluded from coverage by design. */
export const realIo: Io = {
  bunVersion: Bun.version,
  readFile: (path: string): Promise<string> => Bun.file(path).text(),
  readStdin: (): Promise<string> => Bun.stdin.text(),
  which: (command: string): Promise<string | undefined> =>
    Promise.resolve(Bun.which(command) ?? undefined),
  write: (text: string): void => {
    process.stdout.write(text);
  },
  writeError: (text: string): void => {
    process.stderr.write(text);
  },
};
