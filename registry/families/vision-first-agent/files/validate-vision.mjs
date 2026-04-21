// Structural validator for vision-first-agent. Does NOT launch a browser
// or open the camera — just cross-checks that the scaffold wiring is coherent.

import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const [pkgSource, indexHtml, mainTs, viteConfig] = await Promise.all([
  fs.readFile("package.json", "utf8"),
  fs.readFile("index.html", "utf8"),
  fs.readFile("src/main.ts", "utf8"),
  fs.readFile("vite.config.ts", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}

if (!indexHtml.includes('id="cam"')) {
  throw new Error("index.html missing <video id=\"cam\"> — camera surface contract");
}
if (!indexHtml.includes('id="overlay"')) {
  throw new Error("index.html missing <canvas id=\"overlay\"> — box-rendering surface");
}
if (!indexHtml.includes('id="ask"')) {
  throw new Error("index.html missing #ask button — capture trigger");
}

if (!mainTs.includes("getUserMedia")) {
  throw new Error("src/main.ts must call navigator.mediaDevices.getUserMedia for camera access");
}
if (!mainTs.includes("facingMode")) {
  throw new Error("src/main.ts must declare facingMode — mobile rear/front camera selection");
}
if (!mainTs.includes("/api/vision")) {
  throw new Error("src/main.ts must POST to /api/vision — the wiring contract");
}
if (!mainTs.includes("toDataURL") && !mainTs.includes("toBlob")) {
  throw new Error("src/main.ts must serialize the canvas frame via toDataURL or toBlob");
}

if (!viteConfig.includes("/api")) {
  throw new Error("vite.config.ts must proxy /api to the backend during dev");
}

stripTypeScriptTypes(mainTs);

console.log("vision-first-agent starter ok");
