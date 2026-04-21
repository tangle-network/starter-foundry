// Structural validator for multimodal-agent. Does NOT open a browser or
// hit any LLM — just cross-checks the scaffold wiring is coherent.

import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const [pkgSource, indexHtml, mainTsx, appTsx, viteConfig] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("index.html", "utf8"),
  fs.readFile("src/main.tsx", "utf8"),
  fs.readFile("src/App.tsx", "utf8"),
  fs.readFile("vite.config.ts", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}
if (!pkg.dependencies?.react || !pkg.dependencies?.["react-dom"]) {
  throw new Error("package.json must depend on react + react-dom");
}
if (!pkg.devDependencies?.["@vitejs/plugin-react"]) {
  throw new Error("package.json must devDepend on @vitejs/plugin-react");
}

if (!indexHtml.includes('id="root"')) {
  throw new Error('index.html must contain <div id="root"> for React mount');
}
if (!indexHtml.includes("/src/main.tsx")) {
  throw new Error("index.html must reference /src/main.tsx as the module entry");
}

if (!mainTsx.includes("createRoot") || !mainTsx.includes("react-dom/client")) {
  throw new Error("src/main.tsx must mount via createRoot from react-dom/client");
}

// App must exercise all three modalities + the send pipeline.
if (!appTsx.includes("MediaRecorder")) {
  throw new Error("src/App.tsx must use MediaRecorder for the audio panel");
}
if (!appTsx.includes("FormData")) {
  throw new Error("src/App.tsx must pack fields into FormData — JSON bloats base64 payloads");
}
if (!appTsx.includes("/api/multimodal")) {
  throw new Error("src/App.tsx must POST to /api/multimodal — the wiring contract");
}
if (!appTsx.includes("preventDefault")) {
  throw new Error("src/App.tsx must call preventDefault on dragover or the drop handler never fires");
}
if (!appTsx.includes("revokeObjectURL")) {
  throw new Error("src/App.tsx must revokeObjectURL on previews — blob leaks stack up fast");
}

if (!viteConfig.includes("@vitejs/plugin-react")) {
  throw new Error("vite.config.ts must load @vitejs/plugin-react");
}
if (!viteConfig.includes("/api")) {
  throw new Error("vite.config.ts must proxy /api to the backend in dev");
}

stripTypeScriptTypes(appTsx);
stripTypeScriptTypes(mainTsx);

console.log("multimodal-agent starter ok");
