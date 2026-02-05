import { logCommand } from "./log";

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  quiet?: boolean;
}

export interface ExecResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a shell command using Bun's shell
 */
export async function exec(
  command: string,
  options: ExecOptions = {},
): Promise<ExecResult> {
  await logCommand(command);

  try {
    const proc = Bun.spawn(["bash", "-c", command], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdin: options.stdin ? "pipe" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });

    if (options.stdin && proc.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    }

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    return {
      success: exitCode === 0,
      exitCode,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute an interactive command that needs TTY access (e.g., sudo prompts, installers)
 * Output is shown directly to the user, not captured
 */
export async function execInteractive(
  command: string,
  options: Omit<ExecOptions, "stdin" | "quiet"> = {},
): Promise<ExecResult> {
  await logCommand(command);

  try {
    const proc = Bun.spawn(["bash", "-c", command], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;

    return {
      success: exitCode === 0,
      exitCode,
      stdout: "",
      stderr: "",
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(cmd: string): Promise<boolean> {
  const result = await exec(`command -v ${cmd}`);
  return result.success;
}

/**
 * Check if a brew formula is installed
 */
export async function brewFormulaInstalled(formula: string): Promise<boolean> {
  const result = await exec(`brew list --formula ${formula} 2>/dev/null`);
  return result.success;
}

/**
 * Check if a brew cask is installed
 */
export async function brewCaskInstalled(cask: string): Promise<boolean> {
  const result = await exec(`brew list --cask ${cask} 2>/dev/null`);
  return result.success;
}

/**
 * Get brew prefix path
 */
export async function getBrewPrefix(): Promise<string> {
  const result = await exec("brew --prefix");
  return result.success ? result.stdout : "/opt/homebrew";
}
