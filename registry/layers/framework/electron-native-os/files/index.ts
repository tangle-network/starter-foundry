// Main-process entry. The order of operations below is load-bearing:
//
//   1. acquire the single-instance lock FIRST (without it, Windows deep
//      links launch a second copy of the app instead of routing to the
//      running one).
//   2. register custom protocol schemes BEFORE app.whenReady().
//   3. install deep-link listeners BEFORE whenReady so macOS cold-launch
//      open-url events are not lost.
//   4. whenReady: register the app:// file protocol, build the menu,
//      open the main window, boot the updater.

import { app, BrowserWindow, ipcMain, dialog, Notification } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import log from "electron-log";
import { registerAppProtocol, registerPrivilegedSchemes } from "./protocol.js";
import { installDeepLinkHandlers } from "./deeplinks.js";
import { buildApplicationMenu } from "./menu.js";
import { bootAutoUpdater } from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

log.initialize();

// (1) single-instance lock — required for Windows/Linux deep-link routing.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// (2) privileged scheme registration must happen before whenReady().
registerPrivilegedSchemes();

// (3) deep-link plumbing — must attach before whenReady so we catch
// cold-launch open-url on macOS.
const deepLinkState = installDeepLinkHandlers();

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: "{{projectName}}",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadURL("app://local/index.html");
  }

  return win;
}

// Renderer-side dialogs are proxied through IPC so the renderer stays
// sandboxed (contextIsolation on, nodeIntegration off).
ipcMain.handle("dialog:open-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "All Files", extensions: ["*"] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:save-file", async (_event, suggestedName: string) => {
  const result = await dialog.showSaveDialog({ defaultPath: suggestedName });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("notify", async (_event, { title, body }: { title: string; body: string }) => {
  if (!Notification.isSupported()) return false;
  new Notification({ title, body }).show();
  return true;
});

app.whenReady().then(() => {
  // (4a) Install the app:// file protocol now that we have a ready session.
  registerAppProtocol();

  // (4b) Platform menu.
  buildApplicationMenu();

  // (4c) Main window.
  mainWindow = createMainWindow();

  // (4d) Replay any deep link that arrived before the window existed.
  deepLinkState.flushTo((url) => {
    mainWindow?.webContents.send("deeplink", url);
  });

  // (4e) Forward future deep links into the renderer.
  deepLinkState.onUrl((url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents.send("deeplink", url);
    }
  });

  // (4f) Auto-update channel.
  bootAutoUpdater(log);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
