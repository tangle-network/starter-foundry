import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri menu-bar popovers ship a tiny bundle — the panel is 320x400 and
// should open in <100ms. Disable sourcemaps in prod, keep a fixed dev
// port so `cargo tauri dev` can point its webview at it.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "esnext",
    sourcemap: false,
  },
});
