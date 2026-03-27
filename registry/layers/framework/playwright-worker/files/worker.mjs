async function runCycle() {
  console.log("[{{workerName}}] launching automation cycle");
  console.log("[{{workerName}}] visit target page and collect DOM state");
  console.log("browser cycle complete");
}

if (process.env.RUN_ONCE === "1") {
  await runCycle();
  process.exit(0);
}

setInterval(runCycle, 5000);
await runCycle();
