import { DiffStoryError, Errors } from "./errors";
import { renderDoctor, runDoctorChecks } from "./cli/doctor";
import { runAuto, runFormat, runParse, runPlan } from "./cli/commands";
import { CHAPTERS_SCHEMA } from "./chapters";
import { HELP } from "./cli/help";
import type { Io } from "./types";
import { VERSION } from "./version";
import { parseCliArgs } from "./cli/args";

const OK = 0;
const FAIL = 1;
const JSON_INDENT = 2;

const handleError = (error: unknown, io: Io): number => {
  if (error instanceof DiffStoryError) {
    io.writeError(error.format());
    return FAIL;
  }
  let detail = String(error);
  if (error instanceof Error) {
    detail = error.message;
  }
  io.writeError(Errors.unexpected(detail).format());
  return FAIL;
};

/** Entry point: parse args, route to a command, and translate errors to exit codes. */
export const main = async (argv: string[], io: Io): Promise<number> => {
  try {
    const { command, flags } = parseCliArgs(argv);

    if (flags.help) {
      io.write(HELP);
      return OK;
    }
    if (flags.version) {
      io.write(`${VERSION}\n`);
      return OK;
    }
    if (flags.jsonSchema) {
      io.write(`${JSON.stringify(CHAPTERS_SCHEMA, undefined, JSON_INDENT)}\n`);
      return OK;
    }

    switch (command) {
      case "default":
      case "plan": {
        return await runPlan(io);
      }
      case "parse": {
        return await runParse(io);
      }
      case "format": {
        return await runFormat(flags, io);
      }
      case "auto": {
        return await runAuto(flags, io);
      }
      case "doctor": {
        const { checks, code } = await runDoctorChecks(io);
        io.write(renderDoctor(checks));
        return code;
      }
      case "help": {
        io.write(HELP);
        return OK;
      }
      default: {
        throw Errors.unknownCommand(command);
      }
    }
  } catch (error) {
    return handleError(error, io);
  }
};
