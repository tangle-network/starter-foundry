// Structural validator for voice-first-agent. Does NOT open a browser or
// call getUserMedia — just cross-checks the scaffold wiring is coherent.

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

if (!indexHtml.includes('id="talk"')) {
  throw new Error("index.html missing #talk button — voice UI contract");
}
if (!indexHtml.includes('id="playback"')) {
  throw new Error("index.html missing <audio id=\"playback\"> element for TTS playback");
}

if (!mainTs.includes("MediaRecorder")) {
  throw new Error("src/main.ts must use MediaRecorder — browser-native audio capture");
}
if (!mainTs.includes("getUserMedia")) {
  throw new Error("src/main.ts must call navigator.mediaDevices.getUserMedia to request mic access");
}
if (!mainTs.includes("isTypeSupported")) {
  throw new Error("src/main.ts must call MediaRecorder.isTypeSupported before picking a MIME type (Safari compatibility)");
}
if (!mainTs.includes("/api/stt") || !mainTs.includes("/api/llm") || !mainTs.includes("/api/tts")) {
  throw new Error("src/main.ts must POST to /api/stt, /api/llm, /api/tts — the wiring contract");
}

if (!viteConfig.includes("/api")) {
  throw new Error("vite.config.ts must proxy /api to the backend during dev");
}

// main.ts must be parseable TypeScript.
stripTypeScriptTypes(mainTs);

console.log("voice-first-agent starter ok");
