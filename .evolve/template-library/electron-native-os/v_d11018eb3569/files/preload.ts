// The ONLY surface area the renderer sees. Keep this list small and
// typed — every function here is a capability the renderer can exercise
// without needing nodeIntegration. Anything not listed here is not
// reachable from the renderer, by design.

import { contextBridge, ipcRenderer } from "electron";

const api = {
  openFile: (): Promise<string | null> => ipcRenderer.invoke("dialog:open-file"),
  saveFile: (suggestedName: string): Promise<string | null> =>
    ipcRenderer.invoke("dialog:save-file", suggestedName),
  notify: (payload: { title: string; body: string }): Promise<boolean> =>
    ipcRenderer.invoke("notify", payload),
  onDeepLink: (handler: (url: string) => void): (() => void) => {
    const wrapper = (_event: unknown, url: string) => handler(url);
    ipcRenderer.on("deeplink", wrapper);
    return () => ipcRenderer.removeListener("deeplink", wrapper);
  },
  onMenuCommand: (handler: (command: string) => void): (() => void) => {
    const wrapper = (_event: unknown, _payload: unknown, channel: string) =>
      handler(channel.replace(/^menu:/, ""));
    ipcRenderer.on("menu:open", (event, payload) => wrapper(event, payload, "menu:open"));
    ipcRenderer.on("menu:save", (event, payload) => wrapper(event, payload, "menu:save"));
    return () => {
      ipcRenderer.removeAllListeners("menu:open");
      ipcRenderer.removeAllListeners("menu:save");
    };
  },
};

contextBridge.exposeInMainWorld("native", api);

export type NativeApi = typeof api;
