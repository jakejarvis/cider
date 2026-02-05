import type { Config } from "../core/config";
import type { ExecResult } from "../utils/shell";

// ─── Module Types ────────────────────────────────────────────────────────────

export interface ModuleContext {
  config: Config;
  dryRun: boolean;

  /** Execute a shell command, capturing output */
  exec(command: string): Promise<ExecResult>;

  /** Execute an interactive command with TTY access (for sudo prompts, installers, etc.) */
  execInteractive(command: string): Promise<ExecResult>;

  /** Log an info message */
  info(message: string): void;

  /** Log a success message */
  success(message: string): void;

  /** Log a warning message */
  warn(message: string): void;

  /** Log an error message */
  error(message: string): void;

  /** Show dry-run preview message */
  dry(message: string): void;

  /** Prompt for text input */
  prompt(
    message: string,
    options?: { defaultValue?: string; placeholder?: string },
  ): Promise<string>;

  /** Create a progress bar for batch operations */
  progress(options: { max: number }): {
    start(msg?: string): void;
    stop(msg?: string): void;
    message(msg?: string): void;
    advance(step?: number): void;
  };
}

export interface Module {
  /** Unique module identifier */
  name: string;

  /** Category for grouped selection */
  category: string;

  /** Display order (lower = earlier) */
  order: number;

  /** One-line description */
  description: string;

  /** Run the module setup */
  run(ctx: ModuleContext): Promise<void>;
}

// ─── Module Registry ─────────────────────────────────────────────────────────

import { brewModule } from "./brew";
import { gitModule } from "./git";
import { languagesModule } from "./languages";
import { macosModule } from "./macos";
import { shellModule } from "./shell";
import { sshModule } from "./ssh";

export const modules: Module[] = [
  brewModule,
  shellModule,
  gitModule,
  languagesModule,
  macosModule,
  sshModule,
].sort((a, b) => a.order - b.order);

// Derive categories from module metadata
export const moduleCategories: Record<string, string[]> = modules.reduce(
  (acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m.name);
    return acc;
  },
  {} as Record<string, string[]>,
);

export function getModule(name: string): Module | undefined {
  return modules.find((m) => m.name === name);
}

export function getModuleNames(): string[] {
  return modules.map((m) => m.name);
}
