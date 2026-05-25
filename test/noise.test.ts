import { describe, expect, test } from "bun:test";
import type { DiffFile } from "../src/types";
import { classifyNoise } from "../src/noise";

const file = (over: Partial<DiffFile>): DiffFile => ({
  additions: 1,
  binary: false,
  deletions: 1,
  from: "src/a.ts",
  path: "src/a.ts",
  rawText: "",
  to: "src/a.ts",
  ...over,
});

describe("classifyNoise", () => {
  test("a normal source change is signal (undefined)", () => {
    expect(classifyNoise(file({}))).toBeUndefined();
  });

  test("a pure rename with no content change", () => {
    expect(classifyNoise(file({ additions: 0, deletions: 0, from: "a.ts", to: "b.ts" }))).toBe(
      "rename",
    );
  });

  test("a renamed file that also changed content is not a rename", () => {
    expect(classifyNoise(file({ from: "a.ts", to: "b.ts" }))).toBeUndefined();
  });

  test("lock files by basename, including nested paths", () => {
    expect(classifyNoise(file({ path: "package-lock.json" }))).toBe("lockfile");
    expect(classifyNoise(file({ path: "sub/dir/yarn.lock" }))).toBe("lockfile");
  });

  test("files under a generated directory", () => {
    expect(classifyNoise(file({ path: "dist/bundle.js" }))).toBe("generated");
    expect(classifyNoise(file({ path: "a/node_modules/x/y.js" }))).toBe("generated");
  });

  test("files with a generated suffix", () => {
    expect(classifyNoise(file({ path: "app.min.js" }))).toBe("generated");
    expect(classifyNoise(file({ path: "out/app.css.map" }))).toBe("generated");
    expect(classifyNoise(file({ path: "api/service.pb.go" }))).toBe("generated");
    expect(classifyNoise(file({ path: "proto/x_pb2.py" }))).toBe("generated");
  });

  test("a binary patch with no other signal", () => {
    expect(classifyNoise(file({ binary: true, path: "logo.png" }))).toBe("binary");
  });

  test("a generated path takes precedence over the binary flag", () => {
    expect(classifyNoise(file({ binary: true, path: "dist/logo.png" }))).toBe("generated");
  });
});
