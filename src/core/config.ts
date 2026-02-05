import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as clack from "@clack/prompts";
import { parse } from "yaml";

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface ModuleConfig {
  enabled: boolean;
}

export interface BrewConfig {
  taps?: string[];
  formulae?: string[];
  casks?: string[];
  fonts?: string[];
}

export interface ShellConfig {
  default: "zsh" | "fish" | "bash";
  zsh_plugins?: string[];
  starship_preset?: "default" | "nerd-font" | "plain";
}

export interface GitConfig {
  name?: string;
  email?: string;
  default_branch?: string;
  aliases?: boolean;
  sign_commits?: boolean;
  extra_ignores?: string[];
}

export interface NodeConfig {
  enabled?: boolean;
  manager?: "fnm" | "nvm";
  version?: string;
  global_packages?: string[];
}

export interface PythonConfig {
  enabled?: boolean;
  manager?: "uv" | "pyenv";
  version?: string;
  global_tools?: string[];
}

export interface RustConfig {
  enabled?: boolean;
  components?: string[];
}

export interface GoConfig {
  enabled?: boolean;
  version?: string;
}

export interface LanguagesConfig {
  node?: NodeConfig;
  python?: PythonConfig;
  rust?: RustConfig;
  go?: GoConfig;
}

export interface MacOSConfig {
  show_hidden_files?: boolean;
  show_path_bar?: boolean;
  show_status_bar?: boolean;
  default_view?: "list" | "icon" | "column" | "gallery";
  dock_autohide?: boolean;
  dock_size?: number;
  dock_minimize_effect?: "scale" | "genie";
  key_repeat_rate?: number;
  initial_key_repeat?: number;
  tap_to_click?: boolean;
  screenshot_location?: string;
  screenshot_format?: "png" | "jpg" | "pdf" | "tiff";
  disable_ds_store_network?: boolean;
  disable_ds_store_usb?: boolean;
}

export interface SSHConfig {
  generate_key?: boolean;
  key_type?: "ed25519" | "rsa";
  key_comment?: string;
}

export interface Config {
  modules?: Record<string, ModuleConfig>;
  brew?: BrewConfig;
  shell?: ShellConfig;
  git?: GitConfig;
  languages?: LanguagesConfig;
  macos?: MacOSConfig;
  ssh?: SSHConfig;
}

// ─── Config Loading ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  modules: {
    brew: { enabled: true },
    shell: { enabled: true },
    git: { enabled: true },
    languages: { enabled: true },
    macos: { enabled: true },
    ssh: { enabled: true },
  },
  brew: {
    taps: [],
    formulae: [],
    casks: [],
    fonts: [],
  },
  shell: {
    default: "zsh",
    zsh_plugins: [],
    starship_preset: "default",
  },
  git: {
    default_branch: "main",
    aliases: true,
    sign_commits: false,
    extra_ignores: [],
  },
  languages: {
    node: { enabled: true, manager: "fnm", version: "--lts" },
    python: { enabled: true, manager: "uv", version: "3.12" },
    rust: { enabled: true, components: ["clippy", "rustfmt"] },
    go: { enabled: true },
  },
  macos: {
    show_hidden_files: true,
    show_path_bar: true,
    show_status_bar: true,
    default_view: "list",
    dock_autohide: true,
    dock_size: 48,
    dock_minimize_effect: "scale",
    key_repeat_rate: 2,
    initial_key_repeat: 15,
    tap_to_click: true,
    screenshot_location: "~/Desktop/Screenshots",
    screenshot_format: "png",
    disable_ds_store_network: true,
    disable_ds_store_usb: true,
  },
  ssh: {
    generate_key: true,
    key_type: "ed25519",
  },
};

export async function loadConfig(configPath: string): Promise<Config> {
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = parse(content) as Config;
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch (error) {
    clack.log.error(`Failed to parse config file: ${error}`);
    clack.log.warn("Using default configuration");
    return DEFAULT_CONFIG;
  }
}

// ─── Config Helpers ──────────────────────────────────────────────────────────

/**
 * Get a nested value from config using dot notation
 */
export function get<T>(config: Config, path: string, defaultValue: T): T {
  const parts = path.split(".");
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    if (typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return defaultValue;
    }
  }

  return (current as T) ?? defaultValue;
}

/**
 * Get an array value from config
 */
export function getArray(config: Config, path: string): string[] {
  const value = get(config, path, [] as string[]);
  return Array.isArray(value) ? value : [];
}

/**
 * Check if a module is enabled in config
 */
export function isModuleEnabled(config: Config, moduleName: string): boolean {
  return get(config, `modules.${moduleName}.enabled`, true);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}
