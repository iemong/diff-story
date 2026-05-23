import type { Io, LlmClient, LlmRequest } from "../src/types";

export interface FakeLlmOptions {
  text?: string;
  error?: Error;
  inputTokens?: number;
  outputTokens?: number;
  capture?: (request: LlmRequest) => void;
}

export function fakeLlm(options: FakeLlmOptions = {}): LlmClient {
  return {
    complete: (request: LlmRequest) => {
      options.capture?.(request);
      if (options.error !== undefined) {
        return Promise.reject(options.error);
      }
      return Promise.resolve({
        text: options.text ?? "",
        inputTokens: options.inputTokens ?? 0,
        outputTokens: options.outputTokens ?? 0,
      });
    },
  };
}

export interface FakeIoOptions {
  stdin?: string | (() => Promise<string>);
  files?: Record<string, string>;
  env?: Record<string, string | undefined>;
  bunVersion?: string;
  which?: (command: string) => Promise<string | null>;
  llm?: LlmClient;
  now?: () => number;
}

export interface FakeIo extends Io {
  out: string;
  err: string;
}

export function makeIo(options: FakeIoOptions = {}): FakeIo {
  const stdin = options.stdin ?? "";
  const io: FakeIo = {
    out: "",
    err: "",
    readStdin: typeof stdin === "function" ? stdin : () => Promise.resolve(stdin),
    readFile: (path: string) => {
      const files = options.files ?? {};
      if (!(path in files)) {
        return Promise.reject(new Error(`ENOENT: ${path}`));
      }
      return Promise.resolve(files[path]);
    },
    write: (text: string) => {
      io.out += text;
    },
    writeError: (text: string) => {
      io.err += text;
    },
    env: options.env ?? {},
    now: options.now ?? ((): number => 0),
    bunVersion: options.bunVersion ?? "1.0.0-test",
    which: options.which ?? ((): Promise<string | null> => Promise.resolve("/usr/bin/git")),
    createLlm: () => options.llm ?? fakeLlm(),
  };
  return io;
}

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
