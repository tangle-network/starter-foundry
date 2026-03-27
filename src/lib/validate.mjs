import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { createTempDir, fileExists, readJson, removeDir } from "./fs.mjs";
import { composeStarter } from "./compose.mjs";

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function runCommand(command, cwd, env = {}) {
  const [bin, ...args] = command;
  const child = spawn(bin, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return waitForExit(child);
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to reserve port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForHttp(url, expected, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.ok && body.includes(expected)) {
        return { ok: true, body };
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return { ok: false, body: "" };
}

async function runHttpStartCheck(check, cwd) {
  const env = {};
  const port = await reservePort();
  env.PORT = String(port);
  if (check.runOnce) {
    env.RUN_ONCE = "1";
  }

  const [bin, ...args] = check.command;
  const child = spawn(bin, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const url = `http://127.0.0.1:${port}${check.path}`;
    const result = await waitForHttp(url, check.expect, 5000);
    if (!result.ok) {
      throw new Error(`HTTP check failed for ${url}`);
    }
    return { ok: true, stdout, stderr };
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function runCommandSuccessCheck(check, cwd) {
  const result = await runCommand(check.command, cwd, check.env ?? {});
  if (result.code !== 0) {
    throw new Error(`Command failed: ${check.command.join(" ")}`);
  }
  if (check.expect && !result.stdout.includes(check.expect) && !result.stderr.includes(check.expect)) {
    throw new Error(`Command output missing expected text: ${check.expect}`);
  }
  return result;
}

async function runPythonCompileCheck(check, cwd) {
  const result = await runCommand(["python3", "-m", "py_compile", check.path], cwd);
  if (result.code !== 0) {
    throw new Error(result.stderr || `Python compile failed for ${check.path}`);
  }
  return result;
}

async function runCheck(check, cwd) {
  switch (check.type) {
    case "file-exists": {
      const exists = await fileExists(path.join(cwd, check.path));
      if (!exists) {
        throw new Error(`Missing required file ${check.path}`);
      }
      return { type: check.type, path: check.path, ok: true };
    }

    case "node-syntax": {
      const result = await runCommand(["node", "--check", check.path], cwd);
      if (result.code !== 0) {
        throw new Error(result.stderr || `Node syntax failed for ${check.path}`);
      }
      return { type: check.type, path: check.path, ok: true };
    }

    case "http-start": {
      await runHttpStartCheck(check, cwd);
      return { type: check.type, path: check.path, ok: true };
    }

    case "command-success": {
      await runCommandSuccessCheck(check, cwd);
      return { type: check.type, command: check.command, ok: true };
    }

    case "python-compile": {
      await runPythonCompileCheck(check, cwd);
      return { type: check.type, path: check.path, ok: true };
    }

    default:
      throw new Error(`Unsupported validation check ${check.type}`);
  }
}

export async function validateStarter({ spec, outDir = null }) {
  const composedDir = outDir ?? (await createTempDir("starter-foundry-validate"));
  const cleanup = !outDir;
  const composeResult = await composeStarter({ spec, outDir: composedDir });
  const composeReport = await readJson(composeResult.composeReportPath);
  const results = [];

  try {
    for (const check of composeReport.validationChecks) {
      const startedAt = performance.now();
      try {
        const result = await runCheck(check, composedDir);
        results.push({
          ok: true,
          check,
          durationMs: Math.round(performance.now() - startedAt),
          result,
        });
      } catch (error) {
        results.push({
          ok: false,
          check,
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    if (cleanup) {
      await removeDir(composedDir);
    }
  }

  return {
    ok: results.every((result) => result.ok),
    outDir: composedDir,
    checks: results,
  };
}
