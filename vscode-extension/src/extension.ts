// starter-foundry VS Code extension — surfaces manifest validation
// + inline playground. Delegates validation to the repo's canonical
// scripts so nothing duplicates.

import * as vscode from 'vscode'
import { spawn } from 'node:child_process'
import * as path from 'node:path'

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('starter-foundry')
  context.subscriptions.push(diagnostics)

  const validateCmd = vscode.commands.registerCommand('starterFoundry.validateRegistry', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('starter-foundry: open a workspace first')
      return
    }
    const channel = vscode.window.createOutputChannel('starter-foundry')
    channel.show()
    channel.appendLine('running validate-registry...')
    const proc = spawn('node', ['scripts/validate-registry.mjs'], { cwd: workspaceRoot })
    proc.stdout?.on('data', (d) => channel.append(d.toString()))
    proc.stderr?.on('data', (d) => channel.append(d.toString()))
    proc.on('close', (code) => {
      channel.appendLine(`\nvalidate-registry exited ${code}`)
      if (code === 0) vscode.window.showInformationMessage('starter-foundry: registry OK')
      else vscode.window.showErrorMessage('starter-foundry: registry has validation errors (see Output)')
    })
  })
  context.subscriptions.push(validateCmd)

  const playgroundCmd = vscode.commands.registerCommand('starterFoundry.planPrompt', async () => {
    const prompt = await vscode.window.showInputBox({
      prompt: 'Enter a prompt to route through the planner',
      placeHolder: 'Build a Next.js SaaS with Stripe billing',
    })
    if (!prompt) return
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspaceRoot) return
    const channel = vscode.window.createOutputChannel('starter-foundry plan')
    channel.show()
    channel.appendLine(`\nprompt: ${prompt}`)
    const proc = spawn('node', [path.join(workspaceRoot, 'dist/cli.js'), 'plan', '--prompt', prompt], { cwd: workspaceRoot })
    proc.stdout?.on('data', (d) => channel.append(d.toString()))
    proc.stderr?.on('data', (d) => channel.append(d.toString()))
  })
  context.subscriptions.push(playgroundCmd)

  const watcher = vscode.workspace.createFileSystemWatcher('**/registry/**/manifest.json')
  watcher.onDidChange(() => vscode.commands.executeCommand('starterFoundry.validateRegistry'))
  context.subscriptions.push(watcher)
}

export function deactivate(): void {}
