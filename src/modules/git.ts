import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, getArray } from "../core/config";
import { getHomeDir } from "../utils/platform";
import { commandExists } from "../utils/shell";
import type { Module, ModuleContext } from "./index";

export const gitModule: Module = {
  name: "git",
  category: "Development",
  order: 30,
  description: "Configure Git identity, aliases, delta, and global gitignore",

  async run(ctx: ModuleContext): Promise<void> {
    const configName = get(ctx.config, "git.name", "");
    const configEmail = get(ctx.config, "git.email", "");

    // ── Identity ─────────────────────────────────────────────────────────
    let gitName = configName;
    let gitEmail = configEmail;

    // Prompt for missing identity info
    if (!configName) {
      gitName = await ctx.prompt("Git author name:", {
        defaultValue: configName || undefined,
        placeholder: "Your Name",
      });
    }
    if (!configEmail) {
      gitEmail = await ctx.prompt("Git author email:", {
        defaultValue: configEmail || undefined,
        placeholder: "you@example.com",
      });
    }

    if (!gitName) {
      ctx.warn("No git name provided - skipping identity setup");
    } else {
      const result = await ctx.exec(
        `git config --global user.name "${gitName}"`,
      );
      if (!result.success) {
        throw new Error(`Failed to set git user.name: ${result.stderr}`);
      }
      ctx.success(`Git name: ${gitName}`);
    }

    if (!gitEmail) {
      ctx.warn("No git email provided - skipping identity setup");
    } else {
      const result = await ctx.exec(
        `git config --global user.email "${gitEmail}"`,
      );
      if (!result.success) {
        throw new Error(`Failed to set git user.email: ${result.stderr}`);
      }
      ctx.success(`Git email: ${gitEmail}`);
    }

    // ── Default branch ───────────────────────────────────────────────────
    const defaultBranch = get(ctx.config, "git.default_branch", "main");
    await gitConfig(ctx, "init.defaultBranch", defaultBranch);

    // ── Core settings ────────────────────────────────────────────────────
    await gitConfig(ctx, "core.editor", "code --wait");
    await gitConfig(ctx, "core.autocrlf", "input");
    await gitConfig(ctx, "core.pager", "delta");
    await gitConfig(ctx, "push.autoSetupRemote", "true");
    await gitConfig(ctx, "pull.rebase", "true");
    await gitConfig(ctx, "fetch.prune", "true");
    await gitConfig(ctx, "rerere.enabled", "true");
    await gitConfig(ctx, "merge.conflictstyle", "zdiff3");

    // ── Delta (better diffs) ─────────────────────────────────────────────
    if (await commandExists("delta")) {
      await gitConfig(ctx, "interactive.diffFilter", "delta --color-only");
      await gitConfig(ctx, "delta.navigate", "true");
      await gitConfig(ctx, "delta.side-by-side", "true");
      await gitConfig(ctx, "delta.line-numbers", "true");
      await gitConfig(ctx, "delta.hyperlinks", "true");
      ctx.success("Delta configured as git pager");
    }

    // ── Aliases ──────────────────────────────────────────────────────────
    const useAliases = get(ctx.config, "git.aliases", true);

    if (useAliases) {
      ctx.info("Setting up git aliases...");
      await gitConfig(ctx, "alias.s", "status -sb");
      await gitConfig(ctx, "alias.co", "checkout");
      await gitConfig(ctx, "alias.cb", "checkout -b");
      await gitConfig(ctx, "alias.cm", "commit -m");
      await gitConfig(ctx, "alias.ca", "commit --amend --no-edit");
      await gitConfig(ctx, "alias.p", "push");
      await gitConfig(ctx, "alias.pf", "push --force-with-lease");
      await gitConfig(ctx, "alias.pl", "pull --rebase");
      await gitConfig(ctx, "alias.rb", "rebase");
      await gitConfig(ctx, "alias.rbi", "rebase -i");
      await gitConfig(ctx, "alias.undo", "reset --soft HEAD~1");
      await gitConfig(ctx, "alias.nuke", "reset --hard HEAD~1");
      await gitConfig(ctx, "alias.wip", '!git add -A && git commit -m "wip"');
      await gitConfig(
        ctx,
        "alias.lg",
        "log --oneline --graph --decorate --all -20",
      );
      await gitConfig(ctx, "alias.last", "log -1 HEAD --stat");
      await gitConfig(ctx, "alias.branches", "branch -a --sort=-committerdate");
      await gitConfig(ctx, "alias.stale", "branch -vv | grep gone");
      await gitConfig(
        ctx,
        "alias.cleanup",
        "!git branch --merged | grep -v main | xargs git branch -d",
      );
      ctx.success("Git aliases configured");
    }

    // ── Global gitignore ─────────────────────────────────────────────────
    const home = getHomeDir();
    const gitignorePath = join(home, ".gitignore_global");
    ctx.info(`Writing global gitignore -> ${gitignorePath}`);

    if (ctx.dryRun) {
      ctx.dry(`write ${gitignorePath}`);
    } else {
      let content = GITIGNORE_CONTENT;

      // Append extras from config
      const extras = getArray(ctx.config, "git.extra_ignores");
      if (extras.length > 0) {
        content += "\n# === Custom ===\n";
        content += `${extras.join("\n")}\n`;
      }

      await writeFile(gitignorePath, content);
    }

    await gitConfig(ctx, "core.excludesfile", gitignorePath);
    ctx.success("Global gitignore configured");

    // ── Commit signing ───────────────────────────────────────────────────
    const signCommits = get(ctx.config, "git.sign_commits", false);

    if (signCommits) {
      ctx.info("Configuring SSH commit signing...");
      await gitConfig(ctx, "commit.gpgsign", "true");
      await gitConfig(ctx, "gpg.format", "ssh");

      const sshKey = join(home, ".ssh", "id_ed25519.pub");
      if (existsSync(sshKey)) {
        await gitConfig(ctx, "user.signingkey", sshKey);
        ctx.success(`Commit signing enabled with ${sshKey}`);
      } else {
        ctx.warn(`No SSH key found at ${sshKey} - run the ssh module first`);
      }
    }
  },
};

async function gitConfig(
  ctx: ModuleContext,
  key: string,
  value: string,
): Promise<void> {
  const result = await ctx.exec(`git config --global ${key} "${value}"`);
  if (!result.success) {
    throw new Error(`Failed to set git config ${key}: ${result.stderr}`);
  }
}

const GITIGNORE_CONTENT = `# === OS ===
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
Thumbs.db
Desktop.ini

# === Editors ===
*.swp
*.swo
*~
.idea/
.vscode/settings.json
.vscode/launch.json
*.sublime-project
*.sublime-workspace

# === Languages ===
__pycache__/
*.py[cod]
node_modules/
.env
.env.local
.env.*.local

# === Build ===
*.log
*.tmp
dist/
build/
coverage/
.cache/
`;
