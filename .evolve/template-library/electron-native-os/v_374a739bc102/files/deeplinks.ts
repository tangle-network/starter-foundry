// Deep-link routing. Two OS-specific paths:
//
//   - macOS: app.on("open-url", ...) fires when the user clicks a
//     `{{packageName}}://` URL. It can fire BEFORE app.whenReady() on
//     cold launch, so we buffer until the renderer exists.
//
//   - Windows/Linux: no open-url event; the URL arrives as argv on a
//     second-instance launch. We listen to app.on("second-instance")
//     which requires the single-instance lock to be held.
//
// Both paths funnel into a single queue that main/index.ts drains after
// the BrowserWindow is ready.

import { app } from "electron";

type UrlHandler = (url: string) => void;

export interface DeepLinkState {
  flushTo(handler: UrlHandler): void;
  onUrl(handler: UrlHandler): void;
}

export function installDeepLinkHandlers(): DeepLinkState {
  const buffered: string[] = [];
  const subscribers: UrlHandler[] = [];

  function emit(url: string): void {
    if (subscribers.length === 0) {
      buffered.push(url);
      return;
    }
    for (const handler of subscribers) handler(url);
  }

  // macOS cold-launch + warm open-url.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    emit(url);
  });

  // Windows/Linux: the running instance is told about the new argv.
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith("{{packageName}}://"));
    if (url) emit(url);
  });

  return {
    flushTo(handler) {
      const pending = buffered.splice(0, buffered.length);
      for (const url of pending) handler(url);
    },
    onUrl(handler) {
      subscribers.push(handler);
      // Any URLs that arrived before any subscriber existed will have
      // been captured by `buffered` and flushed via flushTo(); nothing
      // to replay here.
    },
  };
}
