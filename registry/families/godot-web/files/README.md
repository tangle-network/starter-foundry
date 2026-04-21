# {{serviceName}}

Godot 4.3 HTML5 starter. The scaffold ships the project skeleton + a Web
export preset; the editor is required to actually export (unlike
bevy-web, Godot's build tool is the editor itself).

## Setup

1. Install Godot 4.3+ from [godotengine.org](https://godotengine.org) (or
   `brew install --cask godot` on macOS).
2. Open the Editor, click *Manage Export Templates*, and download the
   templates that match your editor version exactly (4.3-stable editor
   needs 4.3-stable templates).

## Run in editor

```sh
godot --editor .
# or drag project.godot onto the Godot executable
```

Press **F5** to run the main scene in a native window. Press **F8** to
run the current scene.

## Export to web

**Editor:** *Project → Export → Web → Export Project*. Output lands in
`exports/web/` as `index.html`, `index.js`, `index.wasm`, `index.pck`.

**CLI (CI):**

```sh
godot --headless --export-release 'Web' exports/web/index.html
```

## Serving the export

Godot's HTML5 build requires `SharedArrayBuffer`, which browsers only
expose when the page is served with **cross-origin isolation headers**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these, the canvas stays blank. Configure your static host:

- **Cloudflare Pages**: add a `_headers` file in the output directory
  with the two headers above.
- **Vercel / Netlify**: set them in `vercel.json` / `netlify.toml`
  scoped to the exports/web path.
- **nginx**: `add_header Cross-Origin-Opener-Policy same-origin;
  add_header Cross-Origin-Embedder-Policy require-corp;` inside the
  serving `location` block.

## Project layout

- `project.godot` — engine config, main scene, display size.
- `scenes/main.tscn` — root scene loaded at startup.
- `scripts/main.gd` — GDScript attached to the scene root.
- `export_presets.cfg` — Web target preset.
- `exports/web/` — export output (gitignored by default).

## Gotchas

- **Export templates must match the editor version exactly.** A `4.3-dev`
  template on a `4.3-stable` editor fails silently.
- **Audio is autoplay-blocked** in every browser until the first user
  input; wire audio to a click handler.
- **Never commit `.godot/`** (editor cache) — the supplied .gitignore
  excludes it.
