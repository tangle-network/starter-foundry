# sandbox-app-ts

Non-agent workspace app on Tangle sandbox SDK. Workspace-first layout (file tree / editor / terminal) using `@tangle-network/sandbox-ui`. Use this when you're building on the sandbox SDK but the app isn't agent-chat-driven.

## When to use this family

| You're building | Use |
|---|---|
| Code editor on a sandbox | **sandbox-app-ts** with `appKind: editor` |
| Audit / compliance review tool | **sandbox-app-ts** with `appKind: audit-tool` |
| REPL frontend | **sandbox-app-ts** with `appKind: repl` |
| Plain file browser | **sandbox-app-ts** with `appKind: file-browser` |
| Single agent + chat UI | **agent-with-ui-ts** (different family) |
| Multi-agent dashboard | **orchestrator-with-ui-ts** (different family) |

## What it ships

- `WorkspaceLayout` (resizable directory / center / bottom panes)
- `FileTree` + `FilePreview` (left pane, driven by the sandbox SDK file API)
- `DocumentEditorPane` (center pane, `backend="local"` by default)
- `TerminalPanel` (bottom pane, read-only line stream)
- `lib/sandbox-client.ts` — typed wrapper around `@tangle-network/sandbox` with TODO seams clearly documented for each hook

## Switching `appKind`

The default is `editor`. Change `defaults.appKind` in `manifest.json` (or set `VITE_APP_KIND` at build time). The app picks the right center pane:
- `editor` / `audit-tool` → `DocumentEditorPane`
- `repl` / `file-browser` → `FilePreview` of the selected file

## Required env vars

```
VITE_SANDBOX_API_URL=https://sandbox.tangle.tools
VITE_SANDBOX_API_TOKEN=<your-token>
VITE_SANDBOX_ID=<existing-sandbox-id>
VITE_APP_KIND=editor
```

Without the token or sandbox ID, the app shows a connection error instead of an
empty workspace.

## Collaboration story

`DocumentEditorPane` is collaboration-ready: pass `backend="collaborative"` and a Hocuspocus URL to enable Yjs-backed multi-cursor editing. **The sandbox-SDK collaboration backend (token issuance, document bootstrap, file bridge) is not yet shipped** — see `~/webb/sandbox-ui/SANDBOX-SDK-COLLABORATION-SPEC.md`. Until that lands, leave `backend="local"`. UI-level collaboration code is already wired; only the transport is missing.

## Extension points

- `src/App.tsx` — layout composition. Swap pane content per `appKind`, add toolbars, wire workspace-specific actions.
- `src/lib/sandbox-client.ts` — Sandbox connection, file tree, file I/O, and command execution.

## What's NOT in scope

- No chat surface — if your app is agent-driven, use `agent-with-ui-ts`
- No multi-agent fleet view — use `orchestrator-with-ui-ts`
- No PTY (interactive terminal) — `TerminalPanel` is read-only line stream; live xterm.js/PTY needs custom integration
- No agent-output `:::*` block parsing — that's the `ui-adapter:blocks-renderer` layer (auto-composed for hybrid apps)

## Composition example

```bash
# Compose a code-editor app on a Tangle sandbox
pnpm starter-foundry compose --family sandbox-app-ts --project-name my-editor

# Compose with a collaborative-doc default (still local until SDK lands)
pnpm starter-foundry compose --family sandbox-app-ts --project-name my-spec-doc
# then edit manifest defaults.appKind to "audit-tool" before composing
```
