import * as clack from "@clack/prompts";
import type { Module, ModuleContext } from "../modules/index";
import { moduleCategories, modules } from "../modules/index";
import { log, logResult, logSection } from "../utils/log";
import { exec, execInteractive } from "../utils/shell";
import type { CLIOptions } from "./cli";
import type { Config } from "./config";
import { isModuleEnabled } from "./config";
import { dryRun, section } from "./ui";

// ─── Module Filtering ────────────────────────────────────────────────────────

export function getModulesToRun(config: Config, options: CLIOptions): Module[] {
  return modules.filter((module) => {
    // If --only was specified, module must be in the list
    if (options.only.length > 0) {
      return options.only.includes(module.name);
    }

    // If --skip was specified, module must NOT be in the list
    if (options.skip.includes(module.name)) {
      return false;
    }

    // Check config for enabled/disabled
    return isModuleEnabled(config, module.name);
  });
}

// ─── List Modules ────────────────────────────────────────────────────────────

export function listModules(): void {
  section("Available modules");

  for (const module of modules) {
    console.log(`  ${module.name.padEnd(12)} ${module.description}`);
  }

  console.log();
}

// ─── Interactive Module Selection ────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
  hint: string;
}

export async function selectModules(
  _modulesToRun: Module[],
): Promise<Module[]> {
  // Build grouped options
  const groups: Record<string, SelectOption[]> = {};

  for (const [category, moduleNames] of Object.entries(moduleCategories)) {
    groups[category] = moduleNames
      .map((name) => modules.find((m) => m.name === name))
      .filter((m): m is Module => m !== undefined)
      .map((m) => ({
        value: m.name,
        label: m.name,
        hint: m.description,
      }));
  }

  const result = await clack.groupMultiselect({
    message: "Select modules to run:",
    options: groups,
    required: true,
  });

  if (clack.isCancel(result)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  const selected = result as string[];

  // Preserve module order
  return modules.filter((m) => selected.includes(m.name));
}

// ─── Create Module Context ───────────────────────────────────────────────────

function createModuleContext(
  config: Config,
  options: CLIOptions,
): ModuleContext {
  return {
    config,
    dryRun: options.dryRun,

    async exec(command: string) {
      if (options.dryRun) {
        dryRun(command);
        return { success: true, exitCode: 0, stdout: "", stderr: "" };
      }
      return exec(command);
    },

    async execInteractive(command: string) {
      if (options.dryRun) {
        dryRun(command);
        return { success: true, exitCode: 0, stdout: "", stderr: "" };
      }
      return execInteractive(command);
    },

    info(message: string) {
      clack.log.info(message);
    },

    success(message: string) {
      clack.log.success(message);
    },

    warn(message: string) {
      clack.log.warn(message);
    },

    error(message: string) {
      clack.log.error(message);
    },

    dry(message: string) {
      dryRun(message);
    },

    async prompt(
      message: string,
      options?: { defaultValue?: string; placeholder?: string },
    ) {
      const result = await clack.text({
        message,
        defaultValue: options?.defaultValue,
        placeholder: options?.placeholder,
      });
      if (clack.isCancel(result)) {
        clack.cancel("Operation cancelled");
        process.exit(0);
      }
      return result;
    },

    progress({ max }) {
      return clack.progress({ max });
    },
  };
}

// ─── Run Modules ─────────────────────────────────────────────────────────────

export interface RunResult {
  success: boolean;
  failed: string[];
}

export async function runModules(
  modulesToRun: Module[],
  config: Config,
  options: CLIOptions,
): Promise<RunResult> {
  const failed: string[] = [];

  await log(`=== cider started ===`);
  await log(`Flags: dry_run=${options.dryRun}`);

  for (const module of modulesToRun) {
    section(`Module: ${module.name}`);
    await logSection(module.name);

    const ctx = createModuleContext(config, options);

    try {
      await module.run(ctx);
      clack.log.success(`Module '${module.name}' complete`);
      await logResult(module.name, true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      clack.log.error(`Module '${module.name}' failed: ${errorMessage}`);
      await logResult(module.name, false);
      failed.push(module.name);
    }
  }

  return {
    success: failed.length === 0,
    failed,
  };
}
