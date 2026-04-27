#!/usr/bin/env tsx
/**
 * Deploy an agent bundle to a Tangle sandbox.
 *
 * Reads `agent.json` + referenced markdown from a bundle directory, translates
 * to the SDK's portable AgentProfile, creates a sandbox via
 * `@tangle-network/sandbox`, materialises every resource file inside the box
 * via `box.files.write`, and (optionally) runs an initial task.
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
import { resolve } from 'node:path'
import { argv, env, exit, stdout } from 'node:process'

import {
  loadAgentBundle,
  toAgentProfile,
  type AgentProfileMirror,
} from '../src/lib/agent-bundle.js'

interface CliArgs {
  bundle: string
  name: string
  apiKeyEnv: string
  baseUrl: string
  task?: string
  image: string
  dryRun: boolean
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
    if (!fromEnv) throw new Error('--base-url required (or set TANGLE_SANDBOX_BASE_URL)')
    out.baseUrl = fromEnv
  }
  return {
    bundle: out.bundle!,
    name: out.name!,
    apiKeyEnv: out.apiKeyEnv!,
    baseUrl: out.baseUrl!,
    task: out.task,
    image: out.image ?? 'node:20',
    dryRun: out.dryRun ?? false,
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
  --dry-run                build the AgentProfile + print it, do not call the SDK
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
  const profile = await toAgentProfile(bundle, bundleDir)
  const fileCount = profile.resources?.files?.length ?? 0
  const subagentCount = Object.keys(profile.subagents ?? {}).length
  stdout.write(
    `[deploy-agent] profile built: ` +
      `name=${profile.name} ` +
      `systemPrompt=${profile.prompt?.systemPrompt ? `${profile.prompt.systemPrompt.length} chars` : 'none'} ` +
      `subagents=${subagentCount} ` +
      `files=${fileCount}\n`,
  )

  if (args.dryRun) {
    stdout.write('[deploy-agent] --dry-run: AgentProfile follows\n')
    stdout.write(JSON.stringify(profile, null, 2) + '\n')
    return
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

  for (const mount of profile.resources?.files ?? []) {
    if (mount.resource.kind !== 'inline') continue
    await box.files.write(mount.path, mount.resource.content)
    stdout.write(`[deploy-agent] wrote ${mount.path} (${mount.resource.content.length} bytes)\n`)
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

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[deploy-agent] ERROR: ${message}\n`)
  exit(1)
})
