import { useEffect, useRef, useState } from "react";

// Menu-bar popover is intentionally simple: a search row on top, a
// scrollable list of actions below. Keep the surface under 320x400 —
// anything taller starts feeling like a real window instead of a
// dismissable panel.
type Action = {
  id: string;
  title: string;
  hint: string;
};

const SEED: Action[] = [
  { id: "new-note", title: "New quick note", hint: "Cmd+N" },
  { id: "search-docs", title: "Search documentation", hint: "Cmd+K" },
  { id: "toggle-focus", title: "Toggle focus mode", hint: "Cmd+F" },
  { id: "open-settings", title: "Preferences", hint: "Cmd+," },
];

export default function App() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Popover panels should focus the query row on every show so the
    // user can type immediately without clicking.
    inputRef.current?.focus();
  }, []);

  const filtered = SEED.filter((action) =>
    action.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <main className="popover">
      <header className="popover__header">
        <h1>{{headline}}</h1>
        <p>{{subheadline}}</p>
      </header>
      <input
        ref={inputRef}
        className="popover__query"
        placeholder="Type to search actions…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="popover__list">
        {filtered.map((action) => (
          <li key={action.id} className="popover__row">
            <span>{action.title}</span>
            <kbd>{action.hint}</kbd>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="popover__row popover__row--empty">
            No actions match "{query}"
          </li>
        )}
      </ul>
      <footer className="popover__footer">
        Wire Tauri commands in src-tauri/src/lib.rs to dispatch these actions.
      </footer>
    </main>
  );
}
