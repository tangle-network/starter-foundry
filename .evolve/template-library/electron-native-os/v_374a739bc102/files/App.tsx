import { useEffect, useState } from "react";

// The renderer exercises every native-OS seam exposed via the preload.
// Each card is a smoke-test for one capability — agents can rip them
// out once a real UI is designed but the wiring stays identical.

declare global {
  interface Window {
    native: {
      openFile: () => Promise<string | null>;
      saveFile: (name: string) => Promise<string | null>;
      notify: (payload: { title: string; body: string }) => Promise<boolean>;
      onDeepLink: (handler: (url: string) => void) => () => void;
      onMenuCommand: (handler: (command: string) => void) => () => void;
    };
  }
}

export default function App() {
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [lastDeepLink, setLastDeepLink] = useState<string | null>(null);
  const [lastMenu, setLastMenu] = useState<string | null>(null);

  useEffect(() => {
    const unsubDeep = window.native?.onDeepLink((url) => setLastDeepLink(url));
    const unsubMenu = window.native?.onMenuCommand((cmd) => setLastMenu(cmd));
    return () => {
      unsubDeep?.();
      unsubMenu?.();
    };
  }, []);

  return (
    <main className="shell">
      <header>
        <h1>{{headline}}</h1>
        <p>{{subheadline}}</p>
      </header>

      <section className="cards">
        <article className="card">
          <h2>Native file dialog</h2>
          <p>Opens the OS file picker via IPC — renderer stays sandboxed.</p>
          <button
            onClick={async () => {
              const file = await window.native.openFile();
              if (file) setLastFile(file);
            }}
          >
            Open file…
          </button>
          {lastFile && <code>{lastFile}</code>}
        </article>

        <article className="card">
          <h2>OS notification</h2>
          <p>Dispatches a native banner / action-center toast.</p>
          <button
            onClick={() =>
              window.native.notify({
                title: "{{projectName}}",
                body: "Notifications are wired.",
              })
            }
          >
            Send notification
          </button>
        </article>

        <article className="card">
          <h2>Deep link handler</h2>
          <p>
            Try <code>{{packageName}}://ping</code> from a browser — the URL
            routes into this renderer.
          </p>
          <code>{lastDeepLink ?? "waiting…"}</code>
        </article>

        <article className="card">
          <h2>Menu-bar commands</h2>
          <p>File → Open (Cmd+O) and File → Save (Cmd+S) fire IPC here.</p>
          <code>{lastMenu ?? "waiting…"}</code>
        </article>
      </section>
    </main>
  );
}
