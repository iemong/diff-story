import type { AgentResult, Io } from "../src/types";

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const FIRST = 0;
export const SECOND = 1;

export interface FakeIoOptions {
  stdin?: string | (() => Promise<string>);
  files?: Record<string, string>;
  bunVersion?: string;
  which?: (command: string) => Promise<string | undefined>;
  runAgent?: (command: string, args: string[], input: string) => Promise<AgentResult>;
}

export interface FakeIo extends Io {
  out: string;
  err: string;
}

const toReadStdin = (stdin: string | (() => Promise<string>)): (() => Promise<string>) => {
  if (typeof stdin === "function") {
    return stdin;
  }
  return () => Promise.resolve(stdin);
};

export const makeIo = (options: FakeIoOptions = {}): FakeIo => {
  const io: FakeIo = {
    bunVersion: options.bunVersion ?? "1.0.0-test",
    err: "",
    out: "",
    readFile: (path: string) => {
      const files = options.files ?? {};
      if (!(path in files)) {
        return Promise.reject(new Error(`ENOENT: ${path}`));
      }
      return Promise.resolve(files[path]);
    },
    readStdin: toReadStdin(options.stdin ?? ""),
    runAgent:
      options.runAgent ??
      ((): Promise<AgentResult> => Promise.resolve({ exitCode: 0, stderr: "", stdout: "" })),
    which: options.which ?? ((): Promise<string | undefined> => Promise.resolve("/usr/bin/git")),
    write: (text: string) => {
      io.out += text;
    },
    writeError: (text: string) => {
      io.err += text;
    },
  };
  return io;
};

/** A `which` that reports the executable as absent. */
// eslint-disable-next-line unicorn/no-useless-undefined -- model an absent executable
export const whichMissing = (): Promise<string | undefined> => Promise.resolve(undefined);

export const SIMPLE_DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 1111111..2222222 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,2 +1,2 @@",
  "-const a = 1;",
  "+const a = 2;",
  " export default a;",
  "",
].join("\n");

export const TWO_FILE_DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1 +1 @@",
  "-const a = 1;",
  "+const a = 2;",
  "diff --git a/src/b.ts b/src/b.ts",
  "--- a/src/b.ts",
  "+++ b/src/b.ts",
  "@@ -1 +1 @@",
  "-const b = 1;",
  "+const b = 2;",
  "",
].join("\n");
