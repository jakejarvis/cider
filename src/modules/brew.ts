import { getArray } from "../core/config";
import {
  brewCaskInstalled,
  brewFormulaInstalled,
  commandExists,
} from "../utils/shell";
import type { Module, ModuleContext } from "./index";

export const brewModule: Module = {
  name: "brew",
  category: "Core",
  order: 10,
  description: "Install Homebrew and configured formulae, casks, and fonts",

  async run(ctx: ModuleContext): Promise<void> {
    // ── Install Homebrew if missing ──────────────────────────────────────
    if (!(await commandExists("brew"))) {
      ctx.info("Installing Homebrew...");
      const result = await ctx.execInteractive(
        'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      );
      if (!result.success) {
        throw new Error("Failed to install Homebrew");
      }
    } else {
      ctx.success("Homebrew already installed");
      ctx.info("Updating Homebrew...");
      await ctx.exec("brew update");
    }

    // ── Taps ─────────────────────────────────────────────────────────────
    const taps = getArray(ctx.config, "brew.taps");
    for (const tap of taps) {
      ctx.info(`Tapping ${tap}...`);
      await ctx.exec(`brew tap ${tap}`);
    }

    // ── Formulae ─────────────────────────────────────────────────────────
    const formulae = getArray(ctx.config, "brew.formulae");
    if (formulae.length > 0) {
      const toInstall: string[] = [];

      for (const pkg of formulae) {
        if (!(await brewFormulaInstalled(pkg))) {
          toInstall.push(pkg);
        }
      }

      const alreadyInstalled = formulae.length - toInstall.length;
      if (alreadyInstalled > 0) {
        ctx.success(`${alreadyInstalled} formulae already installed`);
      }

      if (toInstall.length > 0) {
        const p = ctx.progress({ max: toInstall.length });
        p.start(`Installing ${toInstall.length} formulae...`);

        for (const pkg of toInstall) {
          p.message(`Installing ${pkg}...`);
          const result = await ctx.exec(`brew install ${pkg}`);
          if (!result.success) {
            ctx.warn(`Failed to install ${pkg}: ${result.stderr}`);
          }
          p.advance(1);
        }

        p.stop(`Installed ${toInstall.length} formulae`);
      }
    }

    // ── Casks ────────────────────────────────────────────────────────────
    const casks = getArray(ctx.config, "brew.casks");
    if (casks.length > 0) {
      const toInstall: string[] = [];

      for (const cask of casks) {
        if (!(await brewCaskInstalled(cask))) {
          toInstall.push(cask);
        }
      }

      const alreadyInstalled = casks.length - toInstall.length;
      if (alreadyInstalled > 0) {
        ctx.success(`${alreadyInstalled} casks already installed`);
      }

      if (toInstall.length > 0) {
        const p = ctx.progress({ max: toInstall.length });
        p.start(`Installing ${toInstall.length} casks...`);

        for (const cask of toInstall) {
          p.message(`Installing ${cask}...`);
          const result = await ctx.exec(`brew install --cask ${cask}`);
          if (!result.success) {
            ctx.warn(`Failed to install ${cask}: ${result.stderr}`);
          }
          p.advance(1);
        }

        p.stop(`Installed ${toInstall.length} casks`);
      }
    }

    // ── Fonts ────────────────────────────────────────────────────────────
    const fonts = getArray(ctx.config, "brew.fonts");
    if (fonts.length > 0) {
      const toInstall: string[] = [];

      for (const font of fonts) {
        // Auto-prepend "font-" if not present
        const caskName = font.startsWith("font-") ? font : `font-${font}`;
        if (!(await brewCaskInstalled(caskName))) {
          toInstall.push(caskName);
        }
      }

      const alreadyInstalled = fonts.length - toInstall.length;
      if (alreadyInstalled > 0) {
        ctx.success(`${alreadyInstalled} fonts already installed`);
      }

      if (toInstall.length > 0) {
        const p = ctx.progress({ max: toInstall.length });
        p.start(`Installing ${toInstall.length} fonts...`);

        for (const font of toInstall) {
          p.message(`Installing ${font}...`);
          const result = await ctx.exec(`brew install --cask ${font}`);
          if (!result.success) {
            ctx.warn(`Failed to install ${font}: ${result.stderr}`);
          }
          p.advance(1);
        }

        p.stop(`Installed ${toInstall.length} fonts`);
      }
    }

    // ── Cleanup ──────────────────────────────────────────────────────────
    ctx.info("Cleaning up...");
    await ctx.exec("brew cleanup");
  },
};
