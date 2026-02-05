import { $ } from "bun";

export function isMacOS(): boolean {
  return process.platform === "darwin";
}

export function getArch(): "arm64" | "x64" {
  return process.arch === "arm64" ? "arm64" : "x64";
}

export async function getMacOSVersion(): Promise<string> {
  try {
    const result = await $`sw_vers -productVersion`.text();
    return result.trim();
  } catch {
    return "unknown";
  }
}

export function getBrewPrefix(): string {
  return getArch() === "arm64" ? "/opt/homebrew" : "/usr/local";
}

export function getHomeDir(): string {
  return process.env.HOME || Bun.env.HOME || `/Users/${process.env.USER}`;
}
