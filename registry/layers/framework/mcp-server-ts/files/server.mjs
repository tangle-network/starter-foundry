const payload = {
  server: "{{serverName}}",
  tools: ["search", "read_file", "run_command"],
};

if (process.env.RUN_ONCE === "1") {
  console.log("mcp server ok");
  console.log(JSON.stringify(payload));
  process.exit(0);
}

console.log(JSON.stringify({ event: "server.started", ...payload }));
