// Skia ships a .wasm asset for its CanvasKit fallback on some
// environments; register the extension so Metro doesn't skip it.
import { getDefaultConfig } from "expo/metro-config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = getDefaultConfig(__dirname);

config.resolver.assetExts = Array.from(
  new Set([...config.resolver.assetExts, "wasm", "ttf"]),
);

export default config;
