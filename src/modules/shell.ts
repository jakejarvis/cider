import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { get, getArray } from "../core/config";
import { getHomeDir } from "../utils/platform";
import {
  brewFormulaInstalled,
  commandExists,
  getBrewPrefix,
} from "../utils/shell";
import type { Module, ModuleContext } from "./index";

export const shellModule: Module = {
  name: "shell",
  category: "Core",
  order: 20,
  description:
    "Configure shell (zsh/fish), starship prompt, plugins, and aliases",

  async run(ctx: ModuleContext): Promise<void> {
    const defaultShell = get(ctx.config, "shell.default", "zsh") as string;
    ctx.info(`Setting up ${defaultShell}...`);

    if (defaultShell === "zsh") {
      await setupZsh(ctx);
    } else if (defaultShell === "fish") {
      await setupFish(ctx);
    } else {
      ctx.warn(`Unsupported shell: ${defaultShell}, skipping`);
      return;
    }

    await setupStarship(ctx);
  },
};

async function setupZsh(ctx: ModuleContext): Promise<void> {
  const home = getHomeDir();
  const brewPrefix = await getBrewPrefix();
  const brewZsh = `${brewPrefix}/bin/zsh`;

  // Ensure we're using brew's zsh
  if (existsSync(brewZsh)) {
    // Check if it's in /etc/shells
    const grepResult = await ctx.exec(`grep -q "${brewZsh}" /etc/shells`);
    if (!grepResult.success) {
      ctx.info(`Adding ${brewZsh} to /etc/shells`);
      const addResult = await ctx.exec(
        `echo '${brewZsh}' | sudo tee -a /etc/shells`,
      );
      if (!addResult.success) {
        ctx.warn(
          `Failed to add ${brewZsh} to /etc/shells (may need sudo): ${addResult.stderr}`,
        );
      }
    }

    // Change default shell if needed
    const currentShell = process.env.SHELL || "";
    if (currentShell !== brewZsh) {
      ctx.info(`Changing default shell to ${brewZsh}`);
      const chshResult = await ctx.exec(`chsh -s ${brewZsh}`);
      if (!chshResult.success) {
        ctx.warn(
          `Failed to change default shell (may need password): ${chshResult.stderr}`,
        );
      }
    }
  }

  // ── Install zsh plugins via brew ─────────────────────────────────────
  const plugins = getArray(ctx.config, "shell.zsh_plugins");
  for (const plugin of plugins) {
    if (!(await brewFormulaInstalled(plugin))) {
      ctx.info(`Installing zsh plugin: ${plugin}`);
      const result = await ctx.exec(`brew install ${plugin}`);
      if (!result.success) {
        ctx.warn(`Failed to install plugin ${plugin}: ${result.stderr}`);
      } else {
        ctx.success(`Plugin ${plugin} installed`);
      }
    } else {
      ctx.success(`Plugin ${plugin} already installed`);
    }
  }

  // ── Generate .zshrc ──────────────────────────────────────────────────
  const zshrc = join(home, ".zshrc");
  if (existsSync(zshrc) && !ctx.dryRun) {
    const backup = `${zshrc}.backup.${Date.now()}`;
    ctx.warn(`Existing .zshrc found - backing up to ${backup}`);
    await copyFile(zshrc, backup);
  }

  ctx.info(`Writing ${zshrc}`);
  if (ctx.dryRun) {
    ctx.dry(`write ${zshrc}`);
  } else {
    await writeFile(zshrc, ZSHRC_CONTENT);
  }

  ctx.success(".zshrc written (add personal overrides to ~/.zshrc.local)");
}

async function setupFish(ctx: ModuleContext): Promise<void> {
  const home = getHomeDir();
  const brewPrefix = await getBrewPrefix();

  if (!(await commandExists("fish"))) {
    ctx.info("Installing fish...");
    const installResult = await ctx.exec("brew install fish");
    if (!installResult.success) {
      throw new Error(`Failed to install fish: ${installResult.stderr}`);
    }
  }

  const brewFish = `${brewPrefix}/bin/fish`;

  // Add to /etc/shells if needed
  const grepResult = await ctx.exec(`grep -q "${brewFish}" /etc/shells`);
  if (!grepResult.success) {
    ctx.info("Adding fish to /etc/shells");
    const addResult = await ctx.exec(
      `echo '${brewFish}' | sudo tee -a /etc/shells`,
    );
    if (!addResult.success) {
      ctx.warn(
        `Failed to add fish to /etc/shells (may need sudo): ${addResult.stderr}`,
      );
    }
  }

  ctx.info("Changing default shell to fish");
  const chshResult = await ctx.exec(`chsh -s ${brewFish}`);
  if (!chshResult.success) {
    ctx.warn(
      `Failed to change default shell (may need password): ${chshResult.stderr}`,
    );
  }

  // Write fish config
  const fishConfig = join(home, ".config", "fish", "config.fish");
  if (ctx.dryRun) {
    ctx.dry(`write ${fishConfig}`);
  } else {
    await mkdir(dirname(fishConfig), { recursive: true });
    await writeFile(fishConfig, FISH_CONFIG_CONTENT);
  }

  ctx.success("Fish config written");
}

async function setupStarship(ctx: ModuleContext): Promise<void> {
  if (!(await commandExists("starship"))) {
    ctx.warn("Starship not found - skipping prompt config");
    return;
  }

  const home = getHomeDir();
  const preset = get(ctx.config, "shell.starship_preset", "default");
  const configDir = join(home, ".config");
  const starshipConfig = join(configDir, "starship.toml");

  if (!ctx.dryRun) {
    await mkdir(configDir, { recursive: true });
  }

  if (preset === "default") {
    ctx.info("Writing starship config");
    if (ctx.dryRun) {
      ctx.dry(`write ${starshipConfig}`);
    } else {
      await writeFile(starshipConfig, STARSHIP_CONFIG);
    }
    ctx.success("Starship config written");
  } else if (preset === "nerd-font") {
    ctx.info("Applying starship nerd-font preset");
    const result = await ctx.exec(
      `starship preset nerd-font-symbols -o "${starshipConfig}"`,
    );
    if (!result.success) {
      throw new Error(`Failed to apply starship preset: ${result.stderr}`);
    }
    ctx.success("Starship nerd-font preset applied");
  } else if (preset === "plain") {
    ctx.info("Applying starship plain-text preset");
    const result = await ctx.exec(
      `starship preset plain-text-symbols -o "${starshipConfig}"`,
    );
    if (!result.success) {
      throw new Error(`Failed to apply starship preset: ${result.stderr}`);
    }
    ctx.success("Starship plain-text preset applied");
  }
}

// ─── Config Templates ────────────────────────────────────────────────────────

const ZSHRC_CONTENT = `# ┌──────────────────────────────────────────────────────────────────────────┐
# │  .zshrc — generated by cider                                       │
# │  Feel free to edit! Re-running setup won't overwrite without backup.    │
# └──────────────────────────────────────────────────────────────────────────┘

# ── Homebrew ─────────────────────────────────────────────────────────────────
if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
fi

# ── History ──────────────────────────────────────────────────────────────────
HISTSIZE=50000
SAVEHIST=50000
HISTFILE=~/.zsh_history
setopt SHARE_HISTORY          # share across sessions
setopt HIST_IGNORE_ALL_DUPS   # no duplicates
setopt HIST_REDUCE_BLANKS     # trim whitespace
setopt INC_APPEND_HISTORY     # write immediately

# ── Completion ───────────────────────────────────────────────────────────────
autoload -Uz compinit
# Rebuild completion dump once a day
if [[ -z ~/.zcompdump(#qN.mh+24) ]]; then
    compinit
else
    compinit -C
fi
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'  # case-insensitive

# ── Plugins (brew-installed) ─────────────────────────────────────────────────
BREW_PREFIX="$(brew --prefix 2>/dev/null)"
[[ -f "\${BREW_PREFIX}/share/zsh-autosuggestions/zsh-autosuggestions.zsh" ]] \\
    && source "\${BREW_PREFIX}/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
[[ -f "\${BREW_PREFIX}/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ]] \\
    && source "\${BREW_PREFIX}/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
if [[ -d "\${BREW_PREFIX}/share/zsh-completions" ]]; then
    FPATH="\${BREW_PREFIX}/share/zsh-completions:\${FPATH}"
fi

# ── Aliases ──────────────────────────────────────────────────────────────────
# Files & navigation
alias ls='eza --icons --group-directories-first'
alias ll='eza -la --icons --group-directories-first --git'
alias lt='eza --tree --level=2 --icons'
alias cat='bat --paging=never'
alias grep='rg'
alias find='fd'
alias cd='z'                  # zoxide: smarter cd

# Git shortcuts
alias g='git'
alias gs='git status -sb'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline --graph --decorate -20'
alias gd='git diff'
alias gco='git checkout'
alias gb='git branch'
alias gpl='git pull --rebase'

# Misc
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias mkdir='mkdir -p'
alias df='df -h'
alias du='du -h'
alias reload='exec \${SHELL} -l'
alias path='echo $PATH | tr ":" "\\n"'

# ── Tool init ────────────────────────────────────────────────────────────────
# fnm (Node version manager)
if command -v fnm &>/dev/null; then
    eval "$(fnm env --use-on-cd)"
fi

# zoxide (smart cd)
if command -v zoxide &>/dev/null; then
    eval "$(zoxide init zsh)"
fi

# fzf keybindings
if command -v fzf &>/dev/null; then
    source <(fzf --zsh 2>/dev/null) || true
fi

# ── Starship prompt (keep at the end) ────────────────────────────────────────
if command -v starship &>/dev/null; then
    eval "$(starship init zsh)"
fi

# ── Local overrides ─────────────────────────────────────────────────────────
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local
`;

const FISH_CONFIG_CONTENT = `# config.fish — generated by cider

# Homebrew
if test -f /opt/homebrew/bin/brew
    eval (/opt/homebrew/bin/brew shellenv)
end

# Aliases
alias ls 'eza --icons --group-directories-first'
alias ll 'eza -la --icons --group-directories-first --git'
alias cat 'bat --paging=never'
alias g 'git'
alias gs 'git status -sb'

# fnm
if command -q fnm
    fnm env --use-on-cd | source
end

# zoxide
if command -q zoxide
    zoxide init fish | source
end

# Starship
if command -q starship
    starship init fish | source
end
`;

const STARSHIP_CONFIG = `# Starship prompt config — generated by cider

format = """
$directory\\
$git_branch\\
$git_status\\
$python\\
$nodejs\\
$rust\\
$golang\\
$cmd_duration\\
$line_break\\
$character"""

[directory]
truncation_length = 3
truncate_to_repo = true

[git_branch]
symbol = " "
format = "[$symbol$branch]($style) "

[git_status]
format = '([$all_status$ahead_behind]($style) )'

[character]
success_symbol = "[>](bold green)"
error_symbol = "[>](bold red)"

[cmd_duration]
min_time = 2_000
format = "[$duration]($style) "

[python]
symbol = " "
format = '[\${symbol}\${pyenv_prefix}(\${version} )]($style)'

[nodejs]
symbol = " "
format = '[$symbol($version )]($style)'

[rust]
symbol = " "
format = '[$symbol($version )]($style)'

[golang]
symbol = " "
format = '[$symbol($version )]($style)'
`;
