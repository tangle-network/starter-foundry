// Structural validator for unity-web-proxy. Does NOT run Unity (requires
// a licensed editor) and does NOT expect Build/*.wasm to exist (that's
// the user's editor output). Confirms the scaffold wiring is consistent.

import fs from "node:fs/promises";

const [pkgSource, viteConfig, indexHtml, buildScript, readme] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("vite.config.ts", "utf8"),
  fs.readFile("index.html", "utf8"),
  fs.readFile("scripts/build-webgl.sh", "utf8"),
  fs.readFile("README.md", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}
if (!pkg.devDependencies?.vite) {
  throw new Error("package.json missing `vite` devDependency");
}
if (!pkg.scripts?.["build:webgl"]) {
  throw new Error('package.json missing `build:webgl` script');
}

if (!viteConfig.includes("Cross-Origin-Opener-Policy")) {
  throw new Error("vite.config.ts must set Cross-Origin-Opener-Policy header for Unity threads");
}
if (!viteConfig.includes("Cross-Origin-Embedder-Policy")) {
  throw new Error("vite.config.ts must set Cross-Origin-Embedder-Policy header for Unity threads");
}

if (!indexHtml.includes("createUnityInstance")) {
  throw new Error("index.html must call Unity's createUnityInstance() loader");
}
if (!/Build\/.*loader\.js/.test(indexHtml)) {
  throw new Error('index.html must reference a Unity loader at Build/*.loader.js');
}

if (!buildScript.includes("-batchmode")) {
  throw new Error("scripts/build-webgl.sh must invoke Unity with -batchmode");
}
if (!buildScript.includes("-buildTarget WebGL")) {
  throw new Error("scripts/build-webgl.sh must pass -buildTarget WebGL");
}
if (!buildScript.includes("UNITY_PROJECT_PATH")) {
  throw new Error("scripts/build-webgl.sh must honor UNITY_PROJECT_PATH");
}

try {
  await fs.stat("Build/.gitkeep");
} catch {
  throw new Error("Build/.gitkeep must exist to preserve the drop-zone in VCS");
}

if (!readme.includes("SharedArrayBuffer") && !readme.includes("Cross-Origin")) {
  throw new Error("README.md must document the COOP/COEP requirement for Unity WebGL");
}

console.log("unity-web-proxy starter ok");
