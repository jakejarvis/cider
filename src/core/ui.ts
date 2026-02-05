import * as clack from "@clack/prompts";
import pc from "picocolors";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ISSUES_URL = "https://github.com/jakejarvis/cider/issues/new";

// ─── Custom display ──────────────────────────────────────────────────────────

export function section(title: string): void {
  console.log(`\n${pc.cyan(pc.bold(`── ${title} ──`))}\n`);
}

export function banner(version: string): void {
  console.log();
  console.log(
    pc.cyan(pc.bold("    ╔══════════════════════════════════════════╗")),
  );
  console.log(
    pc.cyan(pc.bold("    ║               c i d e r                  ║")),
  );
  console.log(
    pc.cyan(pc.bold("    ║   opinionated macOS dev environment      ║")),
  );
  console.log(
    pc.cyan(pc.bold("    ╚══════════════════════════════════════════╝")),
  );
  console.log(pc.dim(`  v${version}`));
  console.log();
}

export function dryRun(message: string): void {
  clack.log.message(message, { symbol: pc.dim("[dry-run]") });
}

export function errorWithIssueLink(message: string): void {
  clack.log.error(message);
  clack.log.info(
    `If this seems like a bug, please open an issue:\n${pc.underline(pc.cyan(ISSUES_URL))}`,
  );
}
