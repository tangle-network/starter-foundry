import fs from 'node:fs/promises'
import path from 'node:path'
import { createContextPack } from './context-pack.js'
import { createTempDir, ensureDir, writeJson } from './fs.js'
import type { ComposeSpec, ContextPack } from '../types.js'

function buildPrompt(agentName: string, contextPack: ContextPack): string {
  return [
    `You are ${agentName}.`,
    '',
    'Audit and familiarize yourself with this starter project.',
    'Do not redesign it. Learn it, identify risks, and propose the smallest high-value hardening steps.',
    '',
    'Project context:',
    JSON.stringify(
      {
        components: contextPack.components,
        variables: contextPack.variables,
        commands: contextPack.commands,
        entrypoints: contextPack.entrypoints,
        preview: contextPack.preview,
        extensionPoints: contextPack.extensionPoints,
        validationChecks: contextPack.validationChecks,
      },
      null,
      2,
    ),
    '',
    'Return:',
    '1. architecture summary',
    '2. likely failure points',
    '3. first 3 hardening edits',
    '4. missing benchmark cases',
    '5. any mismatch between starter claims and reality',
  ].join('\n')
}

export async function createAuditBundle({
  spec,
  outDir = null,
}: {
  spec: ComposeSpec
  outDir?: string | null
}): Promise<{
  outDir: string
  auditBundlePath: string
  contextPath: string
  promptPaths: { opencode: string; codex: string; claude: string }
}> {
  const auditDir = outDir ?? (await createTempDir('starter-foundry-audit'))
  const contextResult = await createContextPack({ spec, outDir: auditDir })
  const promptsDir = path.join(auditDir, '.starter-foundry', 'prompts')
  const codexPromptPath = path.join(promptsDir, 'codex-audit.txt')
  const claudePromptPath = path.join(promptsDir, 'claude-audit.txt')
  const opencodePromptPath = path.join(promptsDir, 'opencode-audit.txt')
  const auditBundlePath = path.join(auditDir, '.starter-foundry', 'audit-bundle.json')

  await writeJson(auditBundlePath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spec,
    contextPath: contextResult.contextPath,
    prompts: {
      opencode: opencodePromptPath,
      codex: codexPromptPath,
      claude: claudePromptPath,
    },
    suggestedInvocations: [
      `opencode run --format json < ${opencodePromptPath}`,
      `codex < ${codexPromptPath}`,
      `claude < ${claudePromptPath}`,
    ],
  })

  await writeJson(path.join(promptsDir, 'manifest.json'), {
    opencode: 'opencode-audit.txt',
    codex: 'codex-audit.txt',
    claude: 'claude-audit.txt',
  })

  await ensureDir(promptsDir)
  await fs.writeFile(opencodePromptPath, `${buildPrompt('OpenCode', contextResult.contextPack)}\n`, 'utf8')
  await fs.writeFile(codexPromptPath, `${buildPrompt('Codex', contextResult.contextPack)}\n`, 'utf8')
  await fs.writeFile(claudePromptPath, `${buildPrompt('Claude', contextResult.contextPack)}\n`, 'utf8')

  return {
    outDir: auditDir,
    auditBundlePath,
    contextPath: contextResult.contextPath,
    promptPaths: {
      opencode: opencodePromptPath,
      codex: codexPromptPath,
      claude: claudePromptPath,
    },
  }
}
