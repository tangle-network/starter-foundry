import http from "node:http";
import fs from "node:fs/promises";

const port = Number(process.env.PORT || {{port}});

async function readChainConfig() {
  const raw = await fs.readFile(new URL("./chain-config.json", import.meta.url), "utf8");
  return JSON.parse(raw);
}

const server = http.createServer(async (request, response) => {
  const config = await readChainConfig();

  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "evm-infra", chain: config.chainName }));
    return;
  }

  if (request.url === "/stats") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        chain: config.chainName,
        nativeToken: config.nativeToken,
        transport: config.transport,
        mode: "prepared",
      }),
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => {
  console.log(`evm infra service listening on ${port}`);
});
