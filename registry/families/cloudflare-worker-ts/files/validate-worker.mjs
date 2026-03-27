const mod = await import(new URL("./src/worker.ts", import.meta.url));
const response = await mod.default.fetch(new Request("https://example.com/health"), {}, {});
const text = await response.text();

if (!text.includes("{{serviceName}}")) {
  throw new Error("worker response missing service name");
}

console.log("worker ok");
