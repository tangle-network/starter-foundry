import { defineConfig } from "vite";

// getUserMedia is blocked on non-localhost http:// origins. When
// testing from a phone on the same LAN, run `vite --host --https` so
// the browser trusts the origin enough to show the mic permission
// prompt.
export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
});
