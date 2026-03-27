import fs from "node:fs/promises";

const [mainSource, handlerSource, goModSource] = await Promise.all([
  fs.readFile("cmd/server/main.go", "utf8"),
  fs.readFile("internal/app/handlers.go", "utf8"),
  fs.readFile("go.mod", "utf8")
]);

if (!goModSource.includes("module {{packageName}}")) {
  throw new Error("go.mod missing expected module path");
}

if (!mainSource.includes("package main") || !mainSource.includes("ListenAndServe()")) {
  throw new Error("main.go missing server bootstrap");
}

if (!handlerSource.includes('"/health"') || !handlerSource.includes('"{{serviceName}}"')) {
  throw new Error("handlers.go missing health endpoint contract");
}

console.log("go starter ok");
