#!/usr/bin/env bun

/**
 * Build script for cider
 * Handles version injection and multi-architecture builds
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dir, "../package.json"), "utf-8"),
);
const version: string = pkg.version;

type Target = "bun-darwin-arm64" | "bun-darwin-x64";

interface BuildConfig {
  target?: Target;
  outfile: string;
}

const targets: Record<string, BuildConfig> = {
  arm64: { target: "bun-darwin-arm64", outfile: "./dist/cider-darwin-arm64" },
  x64: { target: "bun-darwin-x64", outfile: "./dist/cider-darwin-x64" },
  current: { outfile: "./dist/cider" },
};

async function build(arch: string) {
  const config = targets[arch];
  if (!config) {
    console.error(`Unknown architecture: ${arch}`);
    process.exit(1);
  }

  console.log(`Building ${arch} (v${version})...`);

  const args = [
    "build",
    "--compile",
    "--minify",
    "--sourcemap",
    "--bytecode",
    `--outfile=${config.outfile}`,
    `--define=__APP_VERSION__=${JSON.stringify(version)}`,
    "src/index.ts",
  ];

  // Add target for cross-compilation
  if (config.target) {
    args.push(`--target=${config.target}`);
  }

  const proc = Bun.spawn(["bun", ...args], {
    cwd: join(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`Build failed for ${arch}`);
    process.exit(exitCode);
  }

  console.log(`Built: ${config.outfile}`);
}

// Parse arguments (--arm64, --x64, --current)
const args = process.argv.slice(2);
const archsToBuild = args
  .filter((arg) => arg.startsWith("--"))
  .map((arg) => arg.slice(2));

// Default to both architectures if no flags provided
if (archsToBuild.length === 0) {
  archsToBuild.push("arm64", "x64");
}

for (const arch of archsToBuild) {
  await build(arch);
}

console.log(`\nBuild complete (v${version})`);
