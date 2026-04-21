import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const files = ["src/main.ts", "src/audio.ts", "src/visualizer.ts", "src/peer.ts"];
for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  stripTypeScriptTypes(source);
}

JSON.parse(await fs.readFile("tsconfig.json", "utf8"));

const html = await fs.readFile("index.html", "utf8");
if (!html.includes('/src/main.ts')) {
  throw new Error("index.html must load src/main.ts as a module");
}

const audio = await fs.readFile("src/audio.ts", "utf8");
if (!audio.includes("AudioContext") || !audio.includes("AnalyserNode")) {
  throw new Error("src/audio.ts must set up an AudioContext + AnalyserNode");
}
// Autoplay-unlock check: resume() MUST be called somewhere, otherwise
// the mic meters return all zeros silently.
if (!audio.includes(".resume()")) {
  throw new Error("src/audio.ts must call AudioContext.resume() — autoplay policy requires a user-gesture unlock");
}

const vis = await fs.readFile("src/visualizer.ts", "utf8");
if (!vis.includes("getByteFrequencyData")) {
  throw new Error("src/visualizer.ts must read FFT data via getByteFrequencyData");
}
if (!vis.includes("requestAnimationFrame")) {
  throw new Error("src/visualizer.ts must drive rendering from requestAnimationFrame");
}

const peer = await fs.readFile("src/peer.ts", "utf8");
if (!peer.includes("RTCPeerConnection") || !peer.includes("addTrack")) {
  throw new Error("src/peer.ts must create an RTCPeerConnection and call addTrack before createOffer");
}
if (!peer.includes("SIGNALLING") && !peer.includes("signalling") && !peer.includes("signaling")) {
  throw new Error("src/peer.ts must document where signalling transport plugs in");
}

console.log("realtime audio ok");
