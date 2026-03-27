import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number.parseInt(process.env.PORT || "{{port}}", 10);
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function loadOptionalJson(filePath: string, fallback: Record<string, string>) {
  try {
    const source = await fs.readFile(filePath, "utf8");
    return JSON.parse(source);
  } catch {
    return fallback;
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${port}`);

  if (requestUrl.pathname === "/api/health") {
    const database = await loadOptionalJson(path.join(rootDir, "database-config.json"), {
      provider: "{{databaseProvider}}"
    });
    const hooksPath = path.join(rootDir, "hooks.mjs");
    const hooksPresent = await fs.access(hooksPath).then(() => true).catch(() => false);
    const payload = JSON.stringify({
      status: "ok",
      service: "{{serviceName}}",
      database: database.provider ?? "{{databaseProvider}}",
      hooks: hooksPresent
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(payload);
    return;
  }

  const resolvedPath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
  const filePath = path.join(rootDir, "web", resolvedPath);

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8"
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`fullstack preview listening on ${port}`);
});
