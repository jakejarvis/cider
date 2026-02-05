#!/usr/bin/env bun
import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { parseArgs, VERSION } from "./core/cli";
import { loadConfig } from "./core/config";
import {
  getModulesToRun,
  listModules,
  runModules,
  selectModules,
} from "./core/runner";
import { banner, errorWithIssueLink, ISSUES_URL } from "./core/ui";
import { setLogPath } from "./utils/log";
import { getArch, getMacOSVersion, isMacOS } from "./utils/platform";

// ─── Signal Handling ─────────────────────────────────────────────────────────

process.on("SIGINT", () => {
  console.log();
  clack.cancel("Interrupted by user");
  process.exit(130);
});

process.on("SIGTERM", () => {
  console.log();
  clack.cancel("Terminated");
  process.exit(143);
});

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  // Handle --list
  if (options.list) {
    listModules();
    process.exit(0);
  }

  // Show banner
  banner(VERSION);

  // Pre-flight checks
  if (!isMacOS()) {
    clack.log.error(
      `This tool is designed for macOS. Detected: ${process.platform}`,
    );
    process.exit(1);
  }

  const macVersion = await getMacOSVersion();
  const arch = getArch();

  clack.log.info(`macOS ${macVersion} on ${arch}`);
  clack.log.info(`Config: ${options.config}`);

  // Set up logging
  const logPath = resolve(process.cwd(), "cider.log");
  setLogPath(logPath);
  clack.log.info(`Log: ${logPath}`);

  if (options.dryRun) {
    clack.log.warn("Dry-run mode - no changes will be made");
  }

  console.log();

  // Load config
  const config = await loadConfig(options.config);

  // Get modules to run
  let modulesToRun = getModulesToRun(config, options);

  if (modulesToRun.length === 0) {
    clack.log.warn("No modules selected. Nothing to do.");
    process.exit(0);
  }

  // Let user select modules (unless --only was specified)
  if (options.only.length === 0) {
    modulesToRun = await selectModules(modulesToRun);

    if (modulesToRun.length === 0) {
      clack.log.warn("No modules selected. Nothing to do.");
      process.exit(0);
    }
  }

  clack.log.info(
    `Modules to run: ${modulesToRun.map((m) => m.name).join(", ")}`,
  );
  console.log();

  // Confirm before proceeding
  const proceed = await clack.confirm({
    message: "Ready to set up your dev machine?",
    initialValue: true,
  });

  if (clack.isCancel(proceed) || !proceed) {
    clack.cancel("Aborted.");
    process.exit(0);
  }

  // Run modules
  const result = await runModules(modulesToRun, config, options);

  // Summary
  console.log();

  if (result.success) {
    clack.outro("All modules completed successfully!");
    clack.note(
      `Log saved to ${logPath}\nYou may need to restart your terminal for all changes to take effect.`,
      "Next steps",
    );
  } else {
    clack.log.error(`Some modules failed: ${result.failed.join(", ")}`);
    clack.log.warn(`Check ${logPath} for details`);
    clack.log.info(
      `If this seems like a bug, please open an issue:\n${ISSUES_URL}`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  errorWithIssueLink(`Unexpected error: ${error.message}`);
  process.exit(1);
});
