import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.PORT || "{{port}}", 10);

async function loadJson(name, fallback = null) {
  try {
    const raw = await fs.readFile(path.join(__dirname, name), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const config = await loadJson("agent.config.json", {
  library: "{{agentLibrary}}",
  surface: "{{agentSurface}}",
  loop: ["plan", "act", "reflect"],
});

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(
    JSON.stringify({
      status: "agent",
      service: "{{serviceName}}",
      library: config.library,
      surface: config.surface,
      loop: config.loop,
    }),
  );
});

server.listen(port, "0.0.0.0", () => {
  console.log(`agent service listening on ${port}`);
});
