import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createAuditBundle } from "./audit.mjs";
import { createTempDir, ensureDir, writeJson } from "./fs.mjs";

const DEFAULT_AGENTS = ["opencode", "codex", "claude"];

function classifyFailure(output, exitCode) {
  const lower = output.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("overloaded") ||
    lower.includes("try again later")
  ) {
    return "rate_limited";
  }

  if (
    lower.includes("not logged in") ||
    lower.includes("authentication") ||
    lower.includes("invalid api key") ||
    lower.includes("unauthorized") ||
    lower.includes("login")
  ) {
    return "auth_error";
  }

  if (
    lower.includes("not found") ||
    lower.includes("enoent") ||
    lower.includes("no such file") ||
    lower.includes("command not found")
  ) {
    return "unavailable";
  }

  if (
    lower.includes("timeout") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("network") ||
    lower.includes("connection")
  ) {
    return "transient_error";
  }

  if (exitCode === 0) {
    return "ok";
  }

  return "failed";
}

function resolveAgentCommand(agentName) {
  const envKey = `STARTER_FOUNDRY_${agentName.toUpperCase()}_BIN`;
  const overridden = process.env[envKey];
  const bin = overridden || agentName;

  switch (agentName) {
    case "opencode":
      return {
        bin,
        args: ["run", "--format", "json"],
        promptMode: "arg",
      };

    case "codex":
      return {
        bin,
        args: [
          "exec",
          "--skip-git-repo-check",
          "--sandbox",
          "workspace-write",
          "-",
        ],
        promptMode: "stdin",
      };

    case "claude":
      return {
        bin,
        args: [
          "--print",
          "--output-format",
          "json",
          "--permission-mode",
          "bypassPermissions",
        ],
        promptMode: "arg",
      };

    default:
      throw new Error(`Unsupported agent ${agentName}`);
  }
}

async function runProcess({ bin, args, cwd, stdin, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: 127,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        timedOut,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut,
      });
    });

    child.stdin?.write(stdin);
    child.stdin?.end();
  });
}

async function runSingleAgent({ agentName, promptPath, cwd }) {
  const command = resolveAgentCommand(agentName);
  const prompt = await fs.readFile(promptPath, "utf8");
  const args = command.promptMode === "arg" ? [...command.args, prompt] : command.args;
  const startedAt = performance.now();
  const processResult = await runProcess({
    bin: command.bin,
    args,
    cwd,
    stdin: command.promptMode === "stdin" ? prompt : "",
    timeoutMs: 120000,
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const combinedOutput = `${processResult.stdout}\n${processResult.stderr}`.trim();
  const status = processResult.timedOut
    ? "transient_error"
    : classifyFailure(combinedOutput, processResult.exitCode);

  return {
    agent: agentName,
    status,
    ok: processResult.exitCode === 0,
    durationMs,
    exitCode: processResult.exitCode,
    timedOut: processResult.timedOut,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
  };
}

export async function evaluateAgents({ spec, outDir = null, agents = null }) {
  const evaluationDir = outDir ?? (await createTempDir("starter-foundry-evaluate"));
  const selectedAgents = agents ?? DEFAULT_AGENTS;
  const audit = await createAuditBundle({ spec, outDir: evaluationDir });
  const runsDir = path.join(evaluationDir, ".starter-foundry", "agent-runs");
  await ensureDir(runsDir);

  const results = [];

  for (const agentName of selectedAgents) {
    const promptPath = audit.promptPaths[agentName] ?? audit.promptPaths.codex;
    const result = await runSingleAgent({
      agentName,
      promptPath,
      cwd: evaluationDir,
    });

    const outputPath = path.join(runsDir, `${agentName}.json`);
    await writeJson(outputPath, result);
    results.push({
      ...result,
      outputPath,
    });
  }

  const summary = {
    passRate: results.filter((result) => result.ok).length / results.length,
    statuses: Object.fromEntries(results.map((result) => [result.agent, result.status])),
  };

  const reportPath = path.join(evaluationDir, ".starter-foundry", "agent-evaluation.json");
  await writeJson(reportPath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spec,
    auditBundlePath: audit.auditBundlePath,
    results,
    summary,
  });

  return {
    outDir: evaluationDir,
    reportPath,
    results,
    summary,
  };
}
