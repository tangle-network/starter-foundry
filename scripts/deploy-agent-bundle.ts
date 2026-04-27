#!/usr/bin/env tsx
/**
 * Deploy an agent bundle to a Tangle sandbox.
 *
 * Reads `agent.json` + referenced markdown from a bundle directory, then:
 *  1. Builds the SDK's portable `AgentProfile` (single-agent system prompt,
 *     subagent profiles, model defaults, tools, permissions). This is passed
 *     as `backend.profile` to `client.create()` — full-replacement system
 *     prompt at the SDK layer.
 *  2. Computes harness-native workspace files for `<workspace.root>` (default
 *     `/home/agent`):
 *       - `AGENTS.md`   — auto-loaded by every supported harness
 *                         (OpenCode, Claude Code, Hermes, Codex, Amp, Kimi)
 *       - `agents.json` — multi-agent bundles only; OpenCode subagent shape
 *       - resource files (methodology/, README.md, role assets, …)
 *  3. Creates the sandbox and `box.files.write`s every workspace file.
 *
 * Usage:
 *   pnpm deploy-agent \
 *     --bundle registry/families/agent-runtime-research \
 *     --name research-assistant-demo \
 *     --api-key-env TANGLE_SANDBOX_API_KEY \
 *     --base-url https://sandbox-api.example.com \
 *     [--task "Run the literature survey"]
 *
 * The `@tangle-network/sandbox` package is loaded dynamically. If it's not
 * installed in the consumer environment the script reports a clean GAP rather
 * than failing inside a TypeScript import.
 */
import { spawn } from 'node:child_process'
import { access, constants, readFile } from 'node:fs/promises'
import { isAbsolute, posix, resolve } from 'node:path'
import { argv, cwd, env, exit, stderr, stdout } from 'node:process'

import {
  loadAgentBundle,
  resolveHarness,
  resolveWorkspaceRoot,
  toAgentProfile,
  toWorkspaceFiles,
  type AgentBundleProfile,
  type AgentProfileMirror,
  type Harness,
  type WorkspaceFile,
} from '../src/lib/agent-bundle.js'

interface CliArgs {
  bundle: string
  name: string
  apiKeyEnv: string
  baseUrl: string
  task?: string
  image: string
  dryRun: boolean
  harness?: Harness
  skipHooks: boolean
}

function parseArgs(): CliArgs {
  const args = argv.slice(2)
  const out: Partial<CliArgs> & { image?: string; dryRun?: boolean } = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = (): string => {
      const v = args[++i]
      if (v === undefined) throw new Error(`${arg} requires a value`)
      return v
    }
    switch (arg) {
      case '--bundle':
        out.bundle = next()
        break
      case '--name':
        out.name = next()
        break
      case '--api-key-env':
        out.apiKeyEnv = next()
        break
      case '--base-url':
        out.baseUrl = next()
        break
      case '--task':
        out.task = next()
        break
      case '--image':
        out.image = next()
        break
      case '--dry-run':
        out.dryRun = true
        break
      case '--harness': {
        const value = next()
        if (value !== 'opencode' && value !== 'claude-code' && value !== 'hermes') {
          throw new Error(
            `--harness must be one of: opencode, claude-code, hermes (got "${value}")`,
          )
        }
        out.harness = value
        break
      }
      case '--skip-hooks':
        out.skipHooks = true
        break
      case '--help':
      case '-h':
        printUsage()
        exit(0)
        break
      default:
        throw new Error(`unknown arg: ${arg}`)
    }
  }
  if (!out.bundle) throw new Error('--bundle is required')
  if (!out.name) throw new Error('--name is required')
  if (!out.apiKeyEnv) out.apiKeyEnv = 'TANGLE_SANDBOX_API_KEY'
  if (!out.baseUrl) {
    const fromEnv = env.TANGLE_SANDBOX_BASE_URL ?? env.SANDBOX_BASE_URL
    // Dry-run does not call the SDK; allow base URL to default for visibility.
    if (!fromEnv) {
      if (out.dryRun) out.baseUrl = 'https://sandbox-api.example.invalid'
      else throw new Error('--base-url required (or set TANGLE_SANDBOX_BASE_URL)')
    } else {
      out.baseUrl = fromEnv
    }
  }
  return {
    bundle: out.bundle!,
    name: out.name!,
    apiKeyEnv: out.apiKeyEnv!,
    baseUrl: out.baseUrl!,
    task: out.task,
    image: out.image ?? 'node:20',
    dryRun: out.dryRun ?? false,
    harness: out.harness,
    skipHooks: out.skipHooks ?? false,
  }
}

function printUsage(): void {
  stdout.write(`deploy-agent-bundle — push an agent bundle to a Tangle sandbox

  --bundle <path>          bundle directory containing agent.json (required)
  --name <sandbox-name>    sandbox name to create (required)
  --api-key-env <var>      env var that holds the API key (default TANGLE_SANDBOX_API_KEY)
  --base-url <url>         sandbox API base url (or set TANGLE_SANDBOX_BASE_URL)
  --task <prompt>          optional initial agent task to run after deploy
  --image <image>          base image (default node:20)
  --harness <name>         target harness for workspace-file emit:
                             opencode (default) | claude-code | hermes
  --skip-hooks             skip pre/post deploy hooks even when the bundle declares them
  --dry-run                build the AgentProfile + list workspace files, do not call the SDK

The deploy:
  1. Validates agent.json against registry/_schemas/agent.schema.json
  2. (Optional) Runs hooks/pre script LOCALLY in the user's CWD
  3. Builds the SDK AgentProfile (used as backend.profile for the runtime)
  4. Computes harness-native workspace files. Per --harness:
       opencode    -> AGENTS.md  + agents.json + .mcp.json
       claude-code -> CLAUDE.md  + AGENTS.md (cross-compat copy) + agents.json + .mcp.json
       hermes      -> AGENTS.md  + agents.json + .mcp.json (Hermes MCP path is partial)
  5. Creates the sandbox and box.files.write's each workspace file at the
     resolved workspace root (default /home/agent)
  6. (Optional) Pushes hooks/post script INTO the sandbox and executes it
     after files.write, before any --task invocation.
`)
}

interface SandboxClientLike {
  create(opts: {
    name: string
    image: string
    backend?: { profile?: AgentProfileMirror | string }
  }): Promise<SandboxLike>
}

interface SandboxLike {
  id: string
  waitFor?(state: string): Promise<unknown>
  files: {
    write(path: string, content: string): Promise<unknown>
  }
  exec?(
    command: string | string[],
    options?: Record<string, unknown>,
  ): Promise<{ exitCode: number; stdout?: string; stderr?: string }>
  task(
    prompt: string,
    options?: Record<string, unknown>,
  ): Promise<{ success: boolean; response?: string; error?: string }>
}

async function loadSdk(apiKey: string, baseUrl: string): Promise<SandboxClientLike> {
  const mod = (await import('@tangle-network/sandbox').catch((err: unknown) => {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(
      `GAP: @tangle-network/sandbox is not installed in this environment.\n` +
        `Install it (\`pnpm add @tangle-network/sandbox\`) or run with --dry-run.\n` +
        `Underlying error: ${reason}`,
    )
  })) as { Sandbox: new (opts: { apiKey: string; baseUrl: string }) => SandboxClientLike }
  if (typeof mod.Sandbox !== 'function') {
    throw new Error(
      'GAP: @tangle-network/sandbox loaded but did not expose a `Sandbox` constructor',
    )
  }
  return new mod.Sandbox({ apiKey, baseUrl })
}

async function main(): Promise<void> {
  const args = parseArgs()
  const bundleDir = resolve(args.bundle)
  stdout.write(`[deploy-agent] loading bundle: ${bundleDir}\n`)
  const bundle = await loadAgentBundle(bundleDir)
  const workspaceRoot = resolveWorkspaceRoot(bundle)
  const harness = resolveHarness(bundle, args.harness)
  if (harness === 'hermes') {
    stderr.write(
      `[deploy-agent] WARN harness=hermes: MCP file path translation is partial — ` +
        `emitting .mcp.json. Track upstream gap in docs/issues/sandbox-sdk-deploy-hooks.md.\n`,
    )
  }
  const profile = await toAgentProfile(bundle, bundleDir)
  const workspaceFiles = await toWorkspaceFiles(bundle, bundleDir, { harness })
  const subagentCount = Object.keys(profile.subagents ?? {}).length
  stdout.write(
    `[deploy-agent] profile built: ` +
      `name=${profile.name} ` +
      `harness=${harness} ` +
      `workspace=${workspaceRoot} ` +
      `systemPrompt=${profile.prompt?.systemPrompt ? `${profile.prompt.systemPrompt.length} chars` : 'none'} ` +
      `subagents=${subagentCount} ` +
      `workspace-files=${workspaceFiles.length}\n`,
  )

  if (args.dryRun) {
    if (!args.skipHooks && bundle.hooks?.pre) {
      stdout.write(
        `[deploy-agent] --dry-run: would run pre-hook ${bundle.hooks.pre} ` +
          `LOCALLY in ${cwd()} before sandbox.create\n`,
      )
    }
    stdout.write('[deploy-agent] --dry-run: AgentProfile follows\n')
    stdout.write(JSON.stringify(profile, null, 2) + '\n')
    stdout.write('[deploy-agent] --dry-run: workspace files that would be written:\n')
    for (const f of workspaceFiles) {
      stdout.write(`  ${f.targetPath}  (${f.content.length} bytes)\n`)
    }
    if (!args.skipHooks && bundle.hooks?.post) {
      stdout.write(
        `[deploy-agent] --dry-run: would run post-hook ${bundle.hooks.post} ` +
          `INSIDE the sandbox at ${workspaceRoot} after files.write\n`,
      )
    }
    return
  }

  // Pre-hook runs LOCALLY in the user's CWD before sandbox.create.
  if (!args.skipHooks && bundle.hooks?.pre) {
    await runPreHook(bundle, bundleDir, harness)
  }

  const apiKey = env[args.apiKeyEnv]
  if (!apiKey) {
    throw new Error(`GAP: env var ${args.apiKeyEnv} is unset; cannot reach Tangle sandbox API`)
  }

  const client = await loadSdk(apiKey, args.baseUrl)
  stdout.write(`[deploy-agent] creating sandbox name=${args.name} image=${args.image}\n`)
  const box = await client.create({
    name: args.name,
    image: args.image,
    backend: { profile },
  })
  stdout.write(`[deploy-agent] sandbox created: id=${box.id}\n`)

  if (typeof box.waitFor === 'function') {
    await box.waitFor('running')
  }

  await writeWorkspaceFiles(box, workspaceFiles)

  // Post-hook runs INSIDE the sandbox after files are written, before task().
  if (!args.skipHooks && bundle.hooks?.post) {
    await runPostHook(box, bundle, bundleDir, workspaceRoot)
  }

  if (args.task) {
    stdout.write(`[deploy-agent] running task: ${args.task}\n`)
    const result = await box.task(args.task)
    if (!result.success) {
      throw new Error(`task failed: ${result.error ?? 'unknown error'}`)
    }
    stdout.write(`[deploy-agent] task response:\n${result.response ?? ''}\n`)
  }

  stdout.write(
    `\n[deploy-agent] done. Re-enter this sandbox with:\n` +
      `  const box = await client.get('${box.id}')\n` +
      `  await box.task('your prompt here')\n`,
  )
}

/**
 * Resolve a hook script path against the bundle root. Refuses absolute paths
 * and `..` traversal so a hostile bundle can't ask the deploy script to run
 * `/etc/passwd` or escape the bundle directory.
 */
function resolveHookPath(bundleDir: string, hookRel: string): string {
  if (isAbsolute(hookRel)) {
    throw new Error(`bundle hook path must be relative to bundle root (got "${hookRel}")`)
  }
  const abs = resolve(bundleDir, hookRel)
  if (!abs.startsWith(bundleDir + '/') && abs !== bundleDir) {
    throw new Error(`bundle hook path escapes bundle root (got "${hookRel}")`)
  }
  return abs
}

async function ensureExecutable(path: string): Promise<void> {
  try {
    await access(path, constants.X_OK)
  } catch {
    throw new Error(
      `hook script ${path} is not executable. ` +
        `Run \`chmod +x\` on it, or write a shebanged shell script.`,
    )
  }
}

/**
 * Run the bundle-declared pre-deploy hook on the deploying machine.
 *
 * Contract:
 *   - cwd        : the user's current working directory (NOT the bundle dir)
 *                  — useful for "write to .env in the user's project"
 *   - env        : full parent env, plus
 *                  AGENT_BUNDLE_DIR    = absolute bundle directory
 *                  AGENT_BUNDLE_NAME   = bundle.name
 *                  AGENT_HARNESS       = resolved harness id
 *   - exit code  : non-zero aborts deploy
 */
async function runPreHook(
  bundle: AgentBundleProfile,
  bundleDir: string,
  harness: Harness,
): Promise<void> {
  const rel = bundle.hooks?.pre
  if (!rel) return
  const hookPath = resolveHookPath(bundleDir, rel)
  await ensureExecutable(hookPath)
  stdout.write(`[deploy-agent] running pre-hook ${rel} (LOCAL, cwd=${cwd()})\n`)
  await runLocalScript(hookPath, {
    cwd: cwd(),
    env: {
      ...env,
      AGENT_BUNDLE_DIR: bundleDir,
      AGENT_BUNDLE_NAME: bundle.name,
      AGENT_HARNESS: harness,
    },
  })
}

/**
 * Run the bundle-declared post-deploy hook INSIDE the sandbox.
 *
 * Implementation: pushes the script into the sandbox via `box.files.write`,
 * then `box.exec` chmods + invokes it. Workspace cwd is the resolved root.
 *
 * Falls back to `box.task("run /tmp/post.sh")` only if `box.exec` is
 * unavailable on the SDK (older builds). Surfaces the gap loudly.
 */
async function runPostHook(
  box: SandboxLike,
  bundle: AgentBundleProfile,
  bundleDir: string,
  workspaceRoot: string,
): Promise<void> {
  const rel = bundle.hooks?.post
  if (!rel) return
  const hookPath = resolveHookPath(bundleDir, rel)
  const content = await readFile(hookPath, 'utf8')
  // Use posix.join — sandbox is Linux regardless of host OS.
  const sandboxPath = posix.join(workspaceRoot, '.deploy-hooks', 'post.sh')
  await box.files.write(sandboxPath, content)
  stdout.write(
    `[deploy-agent] pushed post-hook to ${sandboxPath} (${content.length} bytes); executing...\n`,
  )

  if (typeof box.exec !== 'function') {
    throw new Error(
      `GAP: sandbox SDK does not expose box.exec; cannot run post-hook. ` +
        `Skip with --skip-hooks or upgrade @tangle-network/sandbox.`,
    )
  }

  const chmod = await box.exec(['chmod', '+x', sandboxPath])
  if (chmod.exitCode !== 0) {
    throw new Error(
      `post-hook chmod failed (exit ${chmod.exitCode}): ${chmod.stderr ?? '(no stderr)'}`,
    )
  }
  const run = await box.exec(['bash', sandboxPath], { cwd: workspaceRoot })
  if (run.stdout) stdout.write(`[deploy-agent post-hook stdout]\n${run.stdout}\n`)
  if (run.stderr) stderr.write(`[deploy-agent post-hook stderr]\n${run.stderr}\n`)
  if (run.exitCode !== 0) {
    throw new Error(`post-hook exited ${run.exitCode}`)
  }
  stdout.write(`[deploy-agent] post-hook finished cleanly\n`)
}

/**
 * Spawn a local script and wait for it. Stdio is inherited so the user sees
 * hook output directly. Throws on non-zero exit.
 */
function runLocalScript(
  path: string,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<void> {
  return new Promise((res, rej) => {
    const child = spawn(path, [], {
      cwd: options.cwd,
      env: options.env,
      stdio: 'inherit',
    })
    child.on('error', rej)
    child.on('close', (code, signal) => {
      if (signal) return rej(new Error(`pre-hook killed by signal ${signal}`))
      if (code === 0) return res()
      rej(new Error(`pre-hook exited ${code ?? '(unknown)'}`))
    })
  })
}

async function writeWorkspaceFiles(box: SandboxLike, files: WorkspaceFile[]): Promise<void> {
  for (const f of files) {
    await box.files.write(f.targetPath, f.content)
    stdout.write(`[deploy-agent] wrote ${f.targetPath} (${f.content.length} bytes)\n`)
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[deploy-agent] ERROR: ${message}\n`)
  exit(1)
})
