# tauri-menubar

Tauri 2 menu-bar popover scaffold. A tray icon anchors a 320×400 floating panel that shows on left-click and hides on blur — same interaction model as Raycast or 1Password mini.

## Quick start

```sh
pnpm install
cargo tauri dev        # Vite hot-reload + Tauri webview wrapper
```

Click the tray icon in the menu bar to toggle the popover.

## Key files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Popover UI — search input + scrollable action list |
| `src-tauri/src/lib.rs` | TrayIconBuilder, positioner wiring, hide-on-blur handler |
| `src-tauri/tauri.conf.json` | Window config (no decorations, always-on-top, 320×400) |
| `src-tauri/Cargo.toml` | Rust deps: tauri + tray-icon, positioner, global-shortcut |

## Adding Tauri commands

Wire backend logic in `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
async fn my_action() -> String {
    "done".into()
}
// add to Builder:
// .invoke_handler(tauri::generate_handler![my_action])
```

Call from `src/App.tsx`:

```ts
import { invoke } from '@tauri-apps/api/core';
const result = await invoke<string>('my_action');
```

## Before distributing

```sh
cargo tauri icon assets/icon-1024.png   # generates full icon set in src-tauri/icons/
cargo tauri build                       # notarize on macOS before publishing
```

## Notes

- macOS: `ActivationPolicy::Accessory` (set in `lib.rs`) hides the dock icon. Comment it out temporarily if you need Xcode debugger attach.
- Windows hide-on-blur: clicking the tray icon fires `Focused(false)` before the click handler runs; add a ~100ms debounce if you see a show/hide flicker.
- `src-tauri/build.rs` must call `tauri_build::build()` — removing it breaks Tauri's code-gen step.
