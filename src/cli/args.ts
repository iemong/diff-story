import { parseArgs } from "node:util";
import { Errors } from "../errors";

export interface CliFlags {
  help: boolean;
  version: boolean;
  json: boolean;
  jsonSchema: boolean;
  rawPrompt: boolean;
  dryRun: boolean;
  chaptersJson?: string;
  model?: string;
  maxTokens?: string;
}

export interface ParsedCli {
  command: string;
  flags: CliFlags;
}

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  json: { type: "boolean" },
  "json-schema": { type: "boolean" },
  "raw-prompt": { type: "boolean" },
  "dry-run": { type: "boolean" },
  "chapters-json": { type: "string" },
  model: { type: "string" },
  "max-tokens": { type: "string" },
} as const;

/** Parse argv into a command + normalized flags, or throw a DiffStoryError. */
export function parseCliArgs(argv: string[]): ParsedCli {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw Errors.badArguments(error instanceof Error ? error.message : String(error));
  }

  const values = parsed.values;
  return {
    command: parsed.positionals.length > 0 ? parsed.positionals[0] : "default",
    flags: {
      help: values.help === true,
      version: values.version === true,
      json: values.json === true,
      jsonSchema: values["json-schema"] === true,
      rawPrompt: values["raw-prompt"] === true,
      dryRun: values["dry-run"] === true,
      chaptersJson: values["chapters-json"],
      model: values.model,
      maxTokens: values["max-tokens"],
    },
  };
}
