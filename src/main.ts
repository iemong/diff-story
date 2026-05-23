import { CHAPTERS_SCHEMA } from "./chapters";
import { parseCliArgs } from "./cli/args";
import { runFormat, runParse, runPlan } from "./cli/commands";
import { renderDoctor, runDoctorChecks } from "./cli/doctor";
import { HELP } from "./cli/help";
import { DiffStoryError, Errors } from "./errors";
import type { Io } from "./types";
import { VERSION } from "./version";

function handleError(error: unknown, io: Io): number {
  if (error instanceof DiffStoryError) {
    io.writeError(error.format());
    return 1;
  }
  io.writeError(Errors.unexpected(error instanceof Error ? error.message : String(error)).format());
  return 1;
}

/** Entry point: parse args, route to a command, and translate errors to exit codes. */
export async function main(argv: string[], io: Io): Promise<number> {
  try {
    const { command, flags } = parseCliArgs(argv);

    if (flags.help) {
      io.write(HELP);
      return 0;
    }
    if (flags.version) {
      io.write(`${VERSION}\n`);
      return 0;
    }
    if (flags.jsonSchema) {
      io.write(`${JSON.stringify(CHAPTERS_SCHEMA, null, 2)}\n`);
      return 0;
    }

    switch (command) {
      case "default":
      case "plan":
        return await runPlan(io);
      case "parse":
        return await runParse(io);
      case "format":
        return await runFormat(flags, io);
      case "doctor": {
        const { checks, code } = await runDoctorChecks(io);
        io.write(renderDoctor(checks));
        return code;
      }
      case "help":
        io.write(HELP);
        return 0;
      default:
        throw Errors.unknownCommand(command);
    }
  } catch (error) {
    return handleError(error, io);
  }
}
