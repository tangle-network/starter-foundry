'use client'

// DeployFlow — guided modal for the `pnpm exec tsx scripts/deploy-agent-bundle.ts`
// flow. Flag set must match the script's parseArgs() exactly. As of writing:
//
//   --bundle <path>          (required)
//   --name <sandbox-name>    (required)
//   --api-key-env <var>      (default TANGLE_SANDBOX_API_KEY)
//   --base-url <url>         (or TANGLE_SANDBOX_BASE_URL env)
//   --task <prompt>          (optional; runs after deploy)
//   --image <image>          (default node:20)
//   --dry-run                (build profile, don't call SDK)
//
// We render copy-paste commands by default. If DEPLOY_API_URL is wired into
// the host app, swap the final step for a POST with these same fields.

import { useState } from 'react'
import type { Bundle } from '../lib/catalog'

interface Props {
  bundle: Bundle
  /**
   * Path the user should pass to `--bundle`. Defaults to the conventional
   * `registry/families/<id>` path; override in self-hosted layouts.
   */
  bundlePathHint?: string
}

interface DeployForm {
  sandboxName: string
  task: string
  apiKeyEnv: string
  baseUrl: string
  image: string
  dryRun: boolean
}

const INITIAL_FORM: DeployForm = {
  sandboxName: '',
  task: '',
  apiKeyEnv: 'TANGLE_SANDBOX_API_KEY',
  baseUrl: 'https://api.tangle.tools',
  image: 'node:20',
  dryRun: false,
}

function buildCommand(bundle: Bundle, bundlePath: string, f: DeployForm): string {
  const parts = [
    'pnpm exec tsx scripts/deploy-agent-bundle.ts',
    `  --bundle ${bundlePath}`,
    `  --name ${f.sandboxName || '<sandbox-name>'}`,
    `  --api-key-env ${f.apiKeyEnv}`,
    `  --base-url ${f.baseUrl}`,
  ]
  if (f.task.trim()) {
    parts.push(`  --task ${quote(f.task.trim())}`)
  }
  if (f.image && f.image !== 'node:20') {
    parts.push(`  --image ${f.image}`)
  }
  if (f.dryRun) parts.push('  --dry-run')
  void bundle // bundle id already encoded in the path; reserved for future per-shape branches.
  return parts.join(' \\\n')
}

function quote(s: string): string {
  if (!/[\s"'$`\\]/.test(s)) return s
  const escaped = s.replace(/'/g, `'\\''`)
  return `'${escaped}'`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type='button'
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      className='mp-button mp-button-secondary'
      style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', fontSize: '0.75rem' }}
      aria-label='Copy command to clipboard'
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

interface CodeBlockProps {
  text: string
}

function CodeBlock({ text }: CodeBlockProps) {
  return (
    <div className='mp-codeblock'>
      <CopyButton text={text} />
      <pre>{text}</pre>
    </div>
  )
}

export function DeployFlow({ bundle, bundlePathHint }: Props) {
  const [form, setForm] = useState<DeployForm>(INITIAL_FORM)
  const bundlePath = bundlePathHint ?? `registry/families/${bundle.id}`
  const mintCmd = `tangle-admin create-key --product sandbox --label ${bundle.id}-deploy`
  const deployCmd = buildCommand(bundle, bundlePath, form)
  const exportCmd = `export ${form.apiKeyEnv}=sk-tan-...   # paste the minted key`

  return (
    <div>
      <h2 className='mp-h2'>Deploy {bundle.id}</h2>
      <p className='mp-muted' style={{ marginBottom: 24 }}>
        This bundle deploys via <code>scripts/deploy-agent-bundle.ts</code>. The
        script reads <code>agent.json</code> + AGENTS.md from the bundle, builds
        the SDK <code>AgentProfile</code>, creates a Tangle sandbox, and writes
        workspace files at the configured root (default <code>/home/agent</code>).
      </p>

      <section className='mp-step'>
        <h3 className='mp-h2' style={{ fontSize: '1rem' }}>
          <span className='mp-step-num'>1</span>
          Mint a sandbox-scoped Tangle key
        </h3>
        <p className='mp-muted'>
          Run this on a machine that has the Tangle admin CLI authenticated.
          The key is product-scoped to <code>sandbox</code> so it can only
          create + manage sandboxes — no router or billing surface.
        </p>
        <CodeBlock text={mintCmd} />
        <p className='mp-muted' style={{ fontSize: '0.75rem' }}>
          Output: <code>sk-tan-...</code> on stdout. Save it to a password
          manager or pass it to the next step inline.
        </p>
      </section>

      <section className='mp-step'>
        <h3 className='mp-h2' style={{ fontSize: '1rem' }}>
          <span className='mp-step-num'>2</span>
          Configure deploy parameters
        </h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Field label='Sandbox name (required)' hint='Becomes box.id; must be unique to your account.'>
            <input
              type='text'
              className='mp-input'
              placeholder='research-assistant-demo'
              value={form.sandboxName}
              onChange={(e) => setForm({ ...form, sandboxName: e.target.value })}
            />
          </Field>
          <Field label='Initial task (optional)' hint='If set, runs once after the sandbox starts.'>
            <input
              type='text'
              className='mp-input'
              placeholder='Run the literature survey'
              value={form.task}
              onChange={(e) => setForm({ ...form, task: e.target.value })}
            />
          </Field>
          <Field label='API key env var' hint='Env var the script reads for the bearer key.'>
            <input
              type='text'
              className='mp-input'
              value={form.apiKeyEnv}
              onChange={(e) => setForm({ ...form, apiKeyEnv: e.target.value })}
            />
          </Field>
          <Field label='Sandbox API base URL' hint='Override for self-hosted Tangle deployments.'>
            <input
              type='text'
              className='mp-input'
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </Field>
          <Field label='Container image' hint='Default node:20.'>
            <input
              type='text'
              className='mp-input'
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
            />
          </Field>
          <Field label='Mode' hint='Dry run prints the AgentProfile without calling the SDK.'>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
              <input
                type='checkbox'
                checked={form.dryRun}
                onChange={(e) => setForm({ ...form, dryRun: e.target.checked })}
              />
              --dry-run (preview only)
            </label>
          </Field>
        </div>
      </section>

      <section className='mp-step'>
        <h3 className='mp-h2' style={{ fontSize: '1rem' }}>
          <span className='mp-step-num'>3</span>
          Run the deploy command
        </h3>
        <p className='mp-muted'>
          From a starter-foundry checkout (<code>git clone</code> the repo if
          you don't have it), export the API key and run the script:
        </p>
        <CodeBlock text={exportCmd} />
        <CodeBlock text={deployCmd} />
      </section>

      <section className='mp-step'>
        <h3 className='mp-h2' style={{ fontSize: '1rem' }}>
          <span className='mp-step-num'>4</span>
          What you should see
        </h3>
        <p className='mp-muted'>
          The script writes <code>[deploy-agent]</code>-prefixed lines as it
          progresses: bundle load, profile build (system-prompt char count,
          subagent count), sandbox create, file writes for AGENTS.md +
          methodology + (multi-agent only) agents.json, and on success a
          re-entry snippet.
        </p>
        <CodeBlock
          text={`[deploy-agent] loading bundle: registry/families/${bundle.id}
[deploy-agent] profile built: name=... workspace=/home/agent systemPrompt=... chars subagents=${bundle.isMultiAgent ? 'N' : '0'} workspace-files=...
[deploy-agent] creating sandbox name=${form.sandboxName || '<name>'} image=${form.image}
[deploy-agent] sandbox created: id=box-...
[deploy-agent] wrote /home/agent/AGENTS.md (... bytes)
${bundle.isMultiAgent ? '[deploy-agent] wrote /home/agent/agents.json (... bytes)\n' : ''}[deploy-agent] done. Re-enter this sandbox with:
  const box = await client.get('box-...')
  await box.task('your prompt here')`}
        />
        <p className='mp-muted' style={{ fontSize: '0.75rem' }}>
          Once running, drive the agent with <code>box.task()</code> from the
          sandbox SDK or via your own UI (see <code>agent-with-ui-ts</code> /
          <code> orchestrator-with-ui-ts</code>).
        </p>
      </section>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      {children}
      <span className='mp-muted' style={{ fontSize: '0.75rem' }}>
        {hint}
      </span>
    </label>
  )
}
