import { Errors } from "../errors";
import { parseArgs } from "node:util";

const FIRST = 0;

export interface CliFlags {
  help: boolean;
  version: boolean;
  json: boolean;
  jsonSchema: boolean;
  chapters?: string;
  chaptersJson?: string;
  agent?: string;
}

export interface ParsedCli {
  command: string;
  flags: CliFlags;
}

const OPTIONS = {
  agent: { type: "string" },
  chapters: { type: "string" },
  "chapters-json": { type: "string" },
  help: { short: "h", type: "boolean" },
  json: { type: "boolean" },
  "json-schema": { type: "boolean" },
  version: { short: "v", type: "boolean" },
} as const;

type ParsedArgs = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>;

const runParseArgs = (argv: string[]): ParsedArgs => {
  try {
    return parseArgs({ allowPositionals: true, args: argv, options: OPTIONS, strict: true });
  } catch (error) {
    let detail = String(error);
    if (error instanceof Error) {
      detail = error.message;
    }
    throw Errors.badArguments(detail);
  }
};

/** Parse argv into a command + normalized flags, or throw a DiffStoryError. */
export const parseCliArgs = (argv: string[]): ParsedCli => {
  const parsed = runParseArgs(argv);
  const { values } = parsed;
  let command = "default";
  if (parsed.positionals.length > FIRST) {
    command = parsed.positionals[FIRST];
  }
  return {
    command,
    flags: {
      agent: values.agent,
      chapters: values.chapters,
      chaptersJson: values["chapters-json"],
      help: values.help === true,
      json: values.json === true,
      jsonSchema: values["json-schema"] === true,
      version: values.version === true,
    },
  };
};
