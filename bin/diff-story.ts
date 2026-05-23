#!/usr/bin/env bun
import { main } from "../src/main";
import { realIo } from "../src/io";

const ARGV_START = 2;

process.exit(await main(process.argv.slice(ARGV_START), realIo));
