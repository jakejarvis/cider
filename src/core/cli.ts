import { resolve } from "node:path";
import { Command } from "commander";

// Injected at build time via --define __APP_VERSION__
declare const __APP_VERSION__: string;
export const VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0-dev";

export interface CLIOptions {
  dryRun: boolean;
  config: string;
  only: string[];
  skip: string[];
  list: boolean;
  verbose: boolean;
}

export function parseArgs(args: string[]): CLIOptions {
  const program = new Command();

  program
    .name("cider")
    .description("Opinionated macOS developer environment setup")
    .version(VERSION)
    .option("--dry-run", "Preview commands without executing", false)
    .option(
      "-c, --config <path>",
      "Path to config file",
      resolve(process.cwd(), "config.yaml"),
    )
    .option(
      "--only <modules>",
      "Run only specified modules (comma-separated)",
      commaSeparated,
      [],
    )
    .option(
      "--skip <modules>",
      "Skip specified modules (comma-separated)",
      commaSeparated,
      [],
    )
    .option("-l, --list", "List available modules and exit", false)
    .option("-v, --verbose", "Show verbose output", false);

  program.parse(args);
  const opts = program.opts();

  return {
    dryRun: opts.dryRun,
    config: opts.config,
    only: opts.only,
    skip: opts.skip,
    list: opts.list,
    verbose: opts.verbose,
  };
}

function commaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
