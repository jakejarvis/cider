# cider

Opinionated (but customizable) CLI to set up a macOS developer machine from scratch. Supports reusable config files for (somewhat) deterministic results.

Built with [Bun](https://bun.sh) and [@clack/prompts](https://github.com/bombshell-dev/clack) for a beautiful yet lightweight terminal experience.

## What it does

| Module | What gets set up |
|---|---|
| **brew** | Installs Homebrew, then all configured formulae and casks |
| **shell** | Configures zsh (or fish) with plugins, aliases, and a starship prompt |
| **git** | Sets identity, aliases, delta diffs, global gitignore, optional commit signing |
| **languages** | Installs Node (fnm), Python (uv), Rust, and Go with global tools |
| **macos** | Applies opinionated system defaults (Finder, Dock, keyboard, trackpad, screenshots) |
| **ssh** | Generates an ed25519 key, configures SSH, copies pubkey to clipboard for GitHub |

## Install

### Download a release (recommended)

Download the latest signed and notarized binary from [Releases](https://github.com/jakejarvis/cider/releases):

```bash
# Apple Silicon
curl -L https://github.com/jakejarvis/cider/releases/latest/download/cider-darwin-arm64 -o cider
chmod +x cider

# Intel
curl -L https://github.com/jakejarvis/cider/releases/latest/download/cider-darwin-x64 -o cider
chmod +x cider

# Run it
./cider --help
```

### Build from source

```bash
git clone https://github.com/jakejarvis/cider.git
cd cider
bun install
bun run build:current
./dist/cider --help
```

## Quick start

```bash
# Review and edit the config
vim config.yaml

# Run it (interactive mode)
./cider

# Or run with Bun directly during development
bun run start
```

## Usage

```bash
cider                          # interactive - select modules to run
cider --dry-run                # see what would happen without doing anything
cider --only brew,git          # run only specific modules
cider --skip macos             # skip specific modules
cider --config my.yaml         # use a custom config file
cider --list                   # list available modules
```

## Customization

Everything is driven by `config.yaml`. The structure is:

```yaml
# Toggle modules on/off
modules:
  brew:
    enabled: true
  macos:
    enabled: false   # skip macOS defaults

# Customize what gets installed
brew:
  formulae:
    - ripgrep
    - your-tool-here
  casks:
    - firefox
    - your-app-here
  fonts:
    - jetbrains-mono-nerd-font   # "font-" prefix auto-added

# Set your identity
git:
  name: "Your Name"
  email: "you@example.com"

# Pick your tools
languages:
  node:
    manager: fnm     # or "nvm"
  python:
    manager: uv      # or "pyenv"
```

See [`config.yaml`](config.yaml) for the full set of options with comments.

## Adding your own module

Modules are TypeScript files in `src/modules/`. Create a new file and add it to the registry.

```typescript
// src/modules/mysetup.ts
import type { Module, ModuleContext } from "./index";
import { get } from "../core/config";

export const mysetupModule: Module = {
  name: "mysetup",
  category: "Development",  // groups modules in selection UI
  order: 70,                // controls execution order
  description: "My custom setup step",

  async run(ctx: ModuleContext): Promise<void> {
    ctx.info("Starting my setup...");
    ctx.success("Something worked!");
    
    // Execute commands (respects --dry-run)
    await ctx.exec("brew install my-tool");

    // Read config values
    const myOption = get(ctx.config, "mysetup.option", "default");
    
    // Prompt for input
    const answer = await ctx.prompt("What is your name?", {
      placeholder: "Anonymous",
    });
  },
};
```

Then register it in `src/modules/index.ts`.

## Design principles

- **Idempotent** - safe to run multiple times. Skips what is already installed.
- **Transparent** - `--dry-run` shows every command before you commit.
- **Modular** - each concern is isolated. Run, skip, or replace any module.
- **Interactive** - beautiful TUI with grouped module selection and progress bars.
- **Logged** - everything goes to `cider.log`.
- **Backs up** - existing dotfiles are backed up before being overwritten.
- **Local overrides** - shell config sources `~/.zshrc.local` for personal additions.

## After running

1. Restart your terminal (or run `exec zsh`)
2. Add your SSH key to GitHub: https://github.com/settings/ssh/new (it's on your clipboard)
3. Add personal overrides to `~/.zshrc.local`
4. Enjoy your new machine!

## Development

```bash
bun install        # Install dependencies
bun run dev        # Run in dev mode
bun run typecheck  # Type check
bun run lint       # Lint and format check
bun run build      # Build standalone binaries
```

## Building

Build for both macOS architectures:

```bash
bun run build
```

This creates two binaries in `dist/`:
- `cider-darwin-arm64` - Apple Silicon
- `cider-darwin-x64` - Intel

Build for a specific architecture:

```bash
bun run build:arm64   # Apple Silicon only
bun run build:x64     # Intel only
bun run build:current # Current machine's architecture
```

The binaries are self-contained and include:
- The Bun runtime
- All dependencies
- Sourcemaps for debugging

## Releasing

Releases are automated via GitHub Actions. To create a new release:

```bash
# Bump version in package.json
npm version patch  # or minor, major

# Push with tags
git push && git push --tags
```

The workflow will:
1. Build binaries for both architectures
2. Code sign with Developer ID certificate
3. Notarize with Apple
4. Create a GitHub Release with the signed binaries

## License

[MIT](LICENSE)
