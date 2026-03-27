import http from "node:http";

const port = Number.parseInt(process.env.PORT || "{{port}}", 10);

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "zk", proofSystem: "{{proofSystem}}", service: "{{serviceName}}" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ queue: "idle", proofSystem: "{{proofSystem}}" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`zk prover listening on ${port}`);
});
