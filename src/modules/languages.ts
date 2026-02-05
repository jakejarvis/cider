import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { get, getArray } from "../core/config";
import { getHomeDir } from "../utils/platform";
import { commandExists } from "../utils/shell";
import type { Module, ModuleContext } from "./index";

export const languagesModule: Module = {
  name: "languages",
  category: "Development",
  order: 40,
  description:
    "Install Node, Python, Rust, and Go with version managers and global tools",

  async run(ctx: ModuleContext): Promise<void> {
    // ── Node.js ──────────────────────────────────────────────────────────
    if (get(ctx.config, "languages.node.enabled", true)) {
      await setupNode(ctx);
    }

    // ── Python ───────────────────────────────────────────────────────────
    if (get(ctx.config, "languages.python.enabled", true)) {
      await setupPython(ctx);
    }

    // ── Rust ─────────────────────────────────────────────────────────────
    if (get(ctx.config, "languages.rust.enabled", true)) {
      await setupRust(ctx);
    }

    // ── Go ───────────────────────────────────────────────────────────────
    if (get(ctx.config, "languages.go.enabled", true)) {
      await setupGo(ctx);
    }
  },
};

async function setupNode(ctx: ModuleContext): Promise<void> {
  const manager = get(ctx.config, "languages.node.manager", "fnm");
  const version = get(ctx.config, "languages.node.version", "--lts");

  ctx.info(`Setting up Node.js via ${manager}...`);

  if (manager === "fnm") {
    if (!(await commandExists("fnm"))) {
      ctx.info("Installing fnm...");
      const installResult = await ctx.exec("brew install fnm");
      if (!installResult.success) {
        throw new Error(`Failed to install fnm: ${installResult.stderr}`);
      }
    }

    ctx.info(`Installing Node ${version}`);
    const installResult = await ctx.exec(`fnm install ${version}`);
    if (!installResult.success) {
      throw new Error(
        `Failed to install Node ${version}: ${installResult.stderr}`,
      );
    }
    const defaultResult = await ctx.exec(`fnm default ${version}`);
    if (!defaultResult.success) {
      ctx.warn(
        `Failed to set Node ${version} as default: ${defaultResult.stderr}`,
      );
    }
  } else if (manager === "nvm") {
    const home = getHomeDir();
    const nvmDir = join(home, ".nvm");

    if (!existsSync(nvmDir)) {
      ctx.info("Installing nvm...");
      const installResult = await ctx.exec(
        "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash",
      );
      if (!installResult.success) {
        throw new Error(`Failed to install nvm: ${installResult.stderr}`);
      }
    }

    ctx.info(`Installing Node ${version}`);
    // Source nvm and install
    const nvmResult = await ctx.exec(
      `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm install ${version}`,
    );
    if (!nvmResult.success) {
      throw new Error(`Failed to install Node ${version}: ${nvmResult.stderr}`);
    }
  }

  // Global packages
  const packages = getArray(ctx.config, "languages.node.global_packages");
  for (const pkg of packages) {
    ctx.info(`Installing global npm package: ${pkg}`);
    const result = await ctx.exec(`npm install -g ${pkg}`);
    if (!result.success) {
      ctx.warn(`Failed to install npm package ${pkg}: ${result.stderr}`);
    }
  }

  ctx.success("Node.js ready");
}

async function setupPython(ctx: ModuleContext): Promise<void> {
  const manager = get(ctx.config, "languages.python.manager", "uv");
  const version = get(ctx.config, "languages.python.version", "3.12");

  ctx.info(`Setting up Python via ${manager}...`);

  if (manager === "uv") {
    if (!(await commandExists("uv"))) {
      ctx.info("Installing uv...");
      const installResult = await ctx.exec(
        "curl -LsSf https://astral.sh/uv/install.sh | sh",
      );
      if (!installResult.success) {
        throw new Error(`Failed to install uv: ${installResult.stderr}`);
      }
    }

    ctx.info(`Installing Python ${version}`);
    const pythonResult = await ctx.exec(`uv python install ${version}`);
    if (!pythonResult.success) {
      throw new Error(
        `Failed to install Python ${version}: ${pythonResult.stderr}`,
      );
    }

    // Global tools via uv
    const tools = getArray(ctx.config, "languages.python.global_tools");
    for (const tool of tools) {
      ctx.info(`Installing Python tool: ${tool}`);
      const result = await ctx.exec(`uv tool install ${tool}`);
      if (!result.success) {
        ctx.warn(`Failed to install Python tool ${tool}: ${result.stderr}`);
      }
    }
  } else if (manager === "pyenv") {
    if (!(await commandExists("pyenv"))) {
      ctx.info("Installing pyenv...");
      const installResult = await ctx.exec("brew install pyenv");
      if (!installResult.success) {
        throw new Error(`Failed to install pyenv: ${installResult.stderr}`);
      }
    }

    ctx.info(`Installing Python ${version}`);
    const installResult = await ctx.exec(`pyenv install -s ${version}`);
    if (!installResult.success) {
      throw new Error(
        `Failed to install Python ${version}: ${installResult.stderr}`,
      );
    }
    const globalResult = await ctx.exec(`pyenv global ${version}`);
    if (!globalResult.success) {
      ctx.warn(
        `Failed to set Python ${version} as global: ${globalResult.stderr}`,
      );
    }

    // Global tools via pip
    const tools = getArray(ctx.config, "languages.python.global_tools");
    for (const tool of tools) {
      ctx.info(`Installing Python tool: ${tool}`);
      const result = await ctx.exec(`pip install --user ${tool}`);
      if (!result.success) {
        ctx.warn(`Failed to install Python tool ${tool}: ${result.stderr}`);
      }
    }
  }

  ctx.success("Python ready");
}

async function setupRust(ctx: ModuleContext): Promise<void> {
  ctx.info("Setting up Rust...");

  if (!(await commandExists("rustup"))) {
    ctx.info("Installing rustup...");
    const installResult = await ctx.exec(
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    );
    if (!installResult.success) {
      throw new Error(`Failed to install rustup: ${installResult.stderr}`);
    }
  } else {
    ctx.info("Updating Rust toolchain...");
    const updateResult = await ctx.exec("rustup update");
    if (!updateResult.success) {
      ctx.warn(`Failed to update Rust toolchain: ${updateResult.stderr}`);
    }
  }

  // Extra components
  const components = getArray(ctx.config, "languages.rust.components");
  for (const comp of components) {
    const result = await ctx.exec(`rustup component add ${comp}`);
    if (!result.success) {
      ctx.warn(`Failed to add Rust component ${comp}: ${result.stderr}`);
    }
  }

  ctx.success("Rust ready");
}

async function setupGo(ctx: ModuleContext): Promise<void> {
  ctx.info("Setting up Go...");

  if (!(await commandExists("go"))) {
    const installResult = await ctx.exec("brew install go");
    if (!installResult.success) {
      throw new Error(`Failed to install Go: ${installResult.stderr}`);
    }
  } else {
    const result = await ctx.exec("go version");
    if (result.success) {
      ctx.success(`Go already installed (${result.stdout.trim()})`);
    }
  }

  // Set up GOPATH
  const home = getHomeDir();
  const gopath = join(home, "go");

  if (!ctx.dryRun) {
    await mkdir(join(gopath, "bin"), { recursive: true });
    await mkdir(join(gopath, "src"), { recursive: true });
  }

  ctx.success("Go ready");
}
