import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.PORT || "{{port}}", 10);

// tauri-tray is a windowless daemon at runtime. The preview server
// just renders a human-readable summary of what the tray menu will
// look like — there's no renderer to serve.
const menuPreview = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{{projectName}} — Tray Preview</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p { margin: 0 0 24px; opacity: 0.7; }
      .tray { max-width: 240px; background: #1e293b; border: 1px solid rgba(248,250,252,0.08); border-radius: 10px; overflow: hidden; }
      .tray-item { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid rgba(248,250,252,0.06); }
      .tray-item:last-child { border-bottom: 0; }
      .tray-sep { height: 1px; background: rgba(248,250,252,0.08); }
      footer { margin-top: 24px; font-size: 12px; opacity: 0.5; }
    </style>
  </head>
  <body>
    <h1>{{headline}}</h1>
    <p>{{subheadline}}</p>
    <div class="tray">
      <div class="tray-item">● Status: Idle</div>
      <div class="tray-sep"></div>
      <div class="tray-item">Sync now</div>
      <div class="tray-item">Open logs…</div>
      <div class="tray-item">Preferences…</div>
      <div class="tray-sep"></div>
      <div class="tray-item">Quit</div>
    </div>
    <footer>Wire the menu in src-tauri/src/lib.rs — this preview is static HTML only.</footer>
  </body>
</html>`;

const server = http.createServer(async (request, response) => {
  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(menuPreview);
    return;
  }
  try {
    const filePath = path.join(__dirname, request.url.slice(1));
    const content = await fs.readFile(filePath);
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`preview listening on ${port}`);
});
