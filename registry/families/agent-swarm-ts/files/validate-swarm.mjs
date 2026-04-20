import fs from "node:fs/promises";

const [supervisor, researcher, writer, pkgSource] = await Promise.all([
  fs.readFile("src/supervisor.ts", "utf8"),
  fs.readFile("src/agents/researcher.ts", "utf8"),
  fs.readFile("src/agents/writer.ts", "utf8"),
  fs.readFile("package.json", "utf8"),
]);

const pkg = JSON.parse(pkgSource);
if (pkg.name !== "{{packageName}}") {
  throw new Error(`package.json name should be "{{packageName}}", got "${pkg.name}"`);
}
if (!pkg.dependencies?.["@langchain/langgraph"]) {
  throw new Error("package.json missing @langchain/langgraph — swarm needs the orchestrator");
}

if (!supervisor.includes("StateGraph") && !supervisor.includes("createSupervisor")) {
  throw new Error("src/supervisor.ts missing LangGraph StateGraph or createSupervisor call");
}
if (!researcher.includes("export")) {
  throw new Error("src/agents/researcher.ts must export the researcher agent");
}
if (!writer.includes("export")) {
  throw new Error("src/agents/writer.ts must export the writer agent");
}

console.log("agent-swarm-ts starter ok");
