// electron-updater wired to GitHub Releases. The `publish` block in
// electron-builder.json determines the update feed; this file just
// orchestrates the poll + install flow and forwards status to the main
// log so silent failures (missing GH_TOKEN, unsigned binary) surface in
// the user's log file instead of vanishing.

import type electronLog from "electron-log";
import { autoUpdater } from "electron-updater";

export function bootAutoUpdater(log: typeof electronLog): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => log.info("updater: checking"));
  autoUpdater.on("update-available", (info) => log.info("updater: available", info.version));
  autoUpdater.on("update-not-available", () => log.info("updater: up to date"));
  autoUpdater.on("error", (err) => log.error("updater: error", err));
  autoUpdater.on("download-progress", (p) => log.info(`updater: ${p.percent.toFixed(1)}%`));
  autoUpdater.on("update-downloaded", (info) => {
    log.info("updater: downloaded", info.version);
  });

  // Silent failure if the app is unsigned / not-notarized. Don't crash —
  // just log and let the user keep using the running version.
  autoUpdater.checkForUpdates().catch((err) => {
    log.warn("updater: first check failed", err);
  });
}
