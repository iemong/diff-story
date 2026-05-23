import type { Io } from "./types";

/** Production wiring of every side effect. Excluded from coverage by design. */
export const realIo: Io = {
  readStdin: (): Promise<string> => Bun.stdin.text(),
  readFile: (path: string): Promise<string> => Bun.file(path).text(),
  write: (text: string): void => {
    process.stdout.write(text);
  },
  writeError: (text: string): void => {
    process.stderr.write(text);
  },
  bunVersion: Bun.version,
  which: (command: string): Promise<string | null> => Promise.resolve(Bun.which(command)),
};
