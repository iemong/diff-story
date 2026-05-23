#!/usr/bin/env bun
import { realIo } from "../src/io";
import { main } from "../src/main";

process.exit(await main(process.argv.slice(2), realIo));
