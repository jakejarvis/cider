import { mkdir } from "node:fs/promises";
import { get } from "../core/config";
import { getHomeDir } from "../utils/platform";
import type { Module, ModuleContext } from "./index";

export const macosModule: Module = {
  name: "macos",
  category: "System Preferences",
  order: 50,
  description:
    "Configure macOS defaults (Finder, Dock, keyboard, trackpad, screenshots)",

  async run(ctx: ModuleContext): Promise<void> {
    ctx.info("Applying macOS system preferences...");
    ctx.warn("Some changes require a logout or restart to take effect");

    // ── Finder ───────────────────────────────────────────────────────────
    ctx.info("Configuring Finder...");

    if (get(ctx.config, "macos.show_hidden_files", true)) {
      await defaults(
        ctx,
        "write",
        "com.apple.finder",
        "AppleShowAllFiles",
        "-bool",
        "true",
      );
    }

    if (get(ctx.config, "macos.show_path_bar", true)) {
      await defaults(
        ctx,
        "write",
        "com.apple.finder",
        "ShowPathbar",
        "-bool",
        "true",
      );
    }

    if (get(ctx.config, "macos.show_status_bar", true)) {
      await defaults(
        ctx,
        "write",
        "com.apple.finder",
        "ShowStatusBar",
        "-bool",
        "true",
      );
    }

    // Map view names to Finder codes
    const defaultView = get(ctx.config, "macos.default_view", "list");
    const viewCodes: Record<string, string> = {
      list: "Nlsv",
      icon: "icnv",
      column: "clmv",
      gallery: "glyv",
    };
    await defaults(
      ctx,
      "write",
      "com.apple.finder",
      "FXPreferredViewStyle",
      "-string",
      viewCodes[defaultView] || "Nlsv",
    );

    // Show file extensions, disable warning on extension change
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "AppleShowAllExtensions",
      "-bool",
      "true",
    );
    await defaults(
      ctx,
      "write",
      "com.apple.finder",
      "FXEnableExtensionChangeWarning",
      "-bool",
      "false",
    );

    // Search current folder by default
    await defaults(
      ctx,
      "write",
      "com.apple.finder",
      "FXDefaultSearchScope",
      "-string",
      "SCcf",
    );

    // Disable window animations
    await defaults(
      ctx,
      "write",
      "com.apple.finder",
      "DisableAllAnimations",
      "-bool",
      "true",
    );

    // ── Dock ─────────────────────────────────────────────────────────────
    ctx.info("Configuring Dock...");

    if (get(ctx.config, "macos.dock_autohide", true)) {
      await defaults(
        ctx,
        "write",
        "com.apple.dock",
        "autohide",
        "-bool",
        "true",
      );
      await defaults(
        ctx,
        "write",
        "com.apple.dock",
        "autohide-delay",
        "-float",
        "0",
      );
      await defaults(
        ctx,
        "write",
        "com.apple.dock",
        "autohide-time-modifier",
        "-float",
        "0.3",
      );
    }

    const dockSize = get(ctx.config, "macos.dock_size", 48);
    await defaults(
      ctx,
      "write",
      "com.apple.dock",
      "tilesize",
      "-int",
      String(dockSize),
    );

    const minimizeEffect = get(
      ctx.config,
      "macos.dock_minimize_effect",
      "scale",
    );
    await defaults(
      ctx,
      "write",
      "com.apple.dock",
      "mineffect",
      "-string",
      minimizeEffect,
    );

    // Don't show recent apps
    await defaults(
      ctx,
      "write",
      "com.apple.dock",
      "show-recents",
      "-bool",
      "false",
    );

    // Minimize windows into app icon
    await defaults(
      ctx,
      "write",
      "com.apple.dock",
      "minimize-to-application",
      "-bool",
      "true",
    );

    // ── Keyboard ─────────────────────────────────────────────────────────
    ctx.info("Configuring keyboard...");

    const keyRepeat = get(ctx.config, "macos.key_repeat_rate", 2);
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "KeyRepeat",
      "-int",
      String(keyRepeat),
    );

    const initialRepeat = get(ctx.config, "macos.initial_key_repeat", 15);
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "InitialKeyRepeat",
      "-int",
      String(initialRepeat),
    );

    // Disable auto-correct and friends
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSAutomaticSpellingCorrectionEnabled",
      "-bool",
      "false",
    );
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSAutomaticCapitalizationEnabled",
      "-bool",
      "false",
    );
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSAutomaticQuoteSubstitutionEnabled",
      "-bool",
      "false",
    );
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSAutomaticDashSubstitutionEnabled",
      "-bool",
      "false",
    );
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSAutomaticPeriodSubstitutionEnabled",
      "-bool",
      "false",
    );

    // Enable full keyboard access
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "AppleKeyboardUIMode",
      "-int",
      "3",
    );

    // ── Trackpad ─────────────────────────────────────────────────────────
    if (get(ctx.config, "macos.tap_to_click", true)) {
      ctx.info("Enabling tap-to-click...");
      await defaults(
        ctx,
        "write",
        "com.apple.AppleMultitouchTrackpad",
        "Clicking",
        "-bool",
        "true",
      );
      await defaults(
        ctx,
        "write",
        "com.apple.driver.AppleBluetoothMultitouch.trackpad",
        "Clicking",
        "-bool",
        "true",
      );
      await defaults(
        ctx,
        "-currentHost",
        "write",
        "NSGlobalDomain",
        "com.apple.mouse.tapBehavior",
        "-int",
        "1",
      );
    }

    // ── Screenshots ──────────────────────────────────────────────────────
    ctx.info("Configuring screenshots...");

    let screenshotLoc = get(
      ctx.config,
      "macos.screenshot_location",
      "~/Desktop/Screenshots",
    );
    const home = getHomeDir();
    screenshotLoc = screenshotLoc.replace(/^~/, home);

    if (!ctx.dryRun) {
      await mkdir(screenshotLoc, { recursive: true });
    }

    await defaults(
      ctx,
      "write",
      "com.apple.screencapture",
      "location",
      "-string",
      screenshotLoc,
    );

    const screenshotFmt = get(ctx.config, "macos.screenshot_format", "png");
    await defaults(
      ctx,
      "write",
      "com.apple.screencapture",
      "type",
      "-string",
      screenshotFmt,
    );

    // Disable shadow
    await defaults(
      ctx,
      "write",
      "com.apple.screencapture",
      "disable-shadow",
      "-bool",
      "true",
    );

    // ── Misc ─────────────────────────────────────────────────────────────
    if (get(ctx.config, "macos.disable_ds_store_network", true)) {
      await defaults(
        ctx,
        "write",
        "com.apple.desktopservices",
        "DSDontWriteNetworkStores",
        "-bool",
        "true",
      );
    }

    if (get(ctx.config, "macos.disable_ds_store_usb", true)) {
      await defaults(
        ctx,
        "write",
        "com.apple.desktopservices",
        "DSDontWriteUSBStores",
        "-bool",
        "true",
      );
    }

    // Expand save/print panels by default
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSNavPanelExpandedStateForSaveMode",
      "-bool",
      "true",
    );
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSNavPanelExpandedStateForSaveMode2",
      "-bool",
      "true",
    );
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "PMPrintingExpandedStateForPrint",
      "-bool",
      "true",
    );
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "PMPrintingExpandedStateForPrint2",
      "-bool",
      "true",
    );

    // Save to disk by default
    await defaults(
      ctx,
      "write",
      "NSGlobalDomain",
      "NSDocumentSaveNewDocumentsToCloud",
      "-bool",
      "false",
    );

    // ── Restart affected apps ────────────────────────────────────────────
    ctx.info("Restarting Finder and Dock...");
    await ctx.exec("killall Finder 2>/dev/null || true");
    await ctx.exec("killall Dock 2>/dev/null || true");

    ctx.success("macOS defaults applied");
  },
};

async function defaults(ctx: ModuleContext, ...args: string[]): Promise<void> {
  const cmd = `defaults ${args.map((a) => `"${a}"`).join(" ")}`;
  const result = await ctx.exec(cmd);
  if (!result.success) {
    ctx.warn(`Failed to set macOS default: ${cmd}`);
  }
}
