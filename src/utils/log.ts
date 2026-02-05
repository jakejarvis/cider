import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

let logPath: string | null = null;

export function setLogPath(path: string): void {
  logPath = path;
}

export async function log(message: string): Promise<void> {
  if (!logPath) return;

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const line = `[${timestamp}] ${message}\n`;

  try {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, line);
  } catch {
    // Silently fail - logging shouldn't break the app
  }
}

export async function logSection(name: string): Promise<void> {
  await log(`--- ${name} ---`);
}

export async function logCommand(cmd: string): Promise<void> {
  await log(`RUN: ${cmd}`);
}

export async function logResult(name: string, success: boolean): Promise<void> {
  await log(`${name}: ${success ? "OK" : "FAILED"}`);
}
