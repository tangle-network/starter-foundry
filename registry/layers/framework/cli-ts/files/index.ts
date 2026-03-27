const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`Usage: {{packageName}} <command>`);
  console.log("");
  console.log("Commands:");
  console.log("  run      Execute the primary workflow");
  console.log("  doctor   Print environment and config hints");
  process.exit(0);
}

const command = args[0];

if (command === "doctor") {
  console.log("CLI ready");
  console.log("Queue integration can be added through queue-config.json");
  process.exit(0);
}

if (command === "run") {
  console.log("Primary workflow completed");
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
process.exit(1);
