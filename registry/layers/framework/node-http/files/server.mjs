import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.PORT || "{{port}}", 10);

async function loadHooks() {
  try {
    const module = await import("./hooks.mjs");
    return module.default ?? module;
  } catch {
    return {};
  }
}

async function loadPartnerConfig() {
  try {
    const raw = await fs.readFile(path.join(__dirname, "partner-config.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadDatabaseConfig() {
  try {
    const raw = await fs.readFile(path.join(__dirname, "database-config.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const hooks = await loadHooks();
const partner = await loadPartnerConfig();
const database = await loadDatabaseConfig();

const server = http.createServer(async (request, response) => {
  hooks.onRequest?.(request);

  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      status: "ok",
      service: "{{serviceName}}",
      partner: partner?.name ?? null,
      database: database?.provider ?? "{{databaseProvider}}"
    }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({
    service: "{{serviceName}}",
    route: request.url,
    guidance: "Replace this stub with real domain logic.",
    database: database?.provider ?? "{{databaseProvider}}"
  }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`api listening on ${port}`);
});
