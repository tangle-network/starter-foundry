# {{serviceName}}

Unity WebGL build-host scaffold. The scaffold **does not contain the
Unity editor output** — it provides the CI + serving harness to drop a
Unity WebGL build into.

## Layout

```
<this repo>
  Build/            <- Unity editor's WebGL export drops here (gitignored)
  scripts/
    build-webgl.sh  <- Unity CLI batch-mode build script
  index.html        <- Unity loader boot page
  vite.config.ts    <- dev/preview server with COOP/COEP headers
<elsewhere>
  <unity-project>/  <- Assets/, ProjectSettings/, Library/, ...
```

The Unity project source lives elsewhere (a separate repo or a sibling
directory). The CI script here invokes Unity in batch mode against it
and writes output into `Build/`.

## Local dev

```sh
pnpm install
pnpm dev     # serves on 5173 with Cross-Origin-Opener-Policy +
             # Cross-Origin-Embedder-Policy headers (required for
             # Unity threads + SharedArrayBuffer)
```

Drop a Unity WebGL export into `Build/` first — `index.html` expects
`Build/Build.loader.js`. The filename depends on Player Settings →
Product Name; rename on both sides to match.

## CI build

```sh
export UNITY_PROJECT_PATH=/path/to/unity-project
export UNITY_VERSION=2022.3.42f1                    # Unity Hub-installed
export UNITY_BUILD_METHOD=BuildScript.PerformWebGLBuild
bash scripts/build-webgl.sh
```

The build method must exist in the Unity project (typically
`Assets/Editor/Build.cs` with a `[MenuItem]` or static
`BuildPlayerOptions` method). For GitHub Actions, use the
`unityci/editor:ubuntu-<version>-webgl-<patch>` Docker image and
pre-activate the license.

## Gotchas

- **SharedArrayBuffer headers.** Unity 2021.2+ WebGL builds enable
  threads by default and require `Cross-Origin-Opener-Policy:
  same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Vite's
  server (`vite.config.ts`) sends these; production hosts must too.
- **Compression.** Unity's `.br` (Brotli) and `.gz` (gzip) files need
  the matching `Content-Encoding` response header. Static hosts that
  strip headers will serve corrupted bundles. Either disable compression
  in Player Settings → WebGL or verify with `curl -I`.
- **Loader filenames.** `Build.loader.js` / `Build.framework.js` /
  `Build.wasm` / `Build.data` derive from Player Settings → Product
  Name. First editor export changes them; update `index.html` to match.
- **License.** Batch-mode Unity requires an activated license.
  CI without a license exits with code 12 after the 30-day trial.
- **No multi-threaded GC.** WebGL builds use a single GC thread — long
  pauses are visible as freezes. Keep per-frame allocations low.
