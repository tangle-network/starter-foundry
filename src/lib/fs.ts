import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as T
}

export async function resolveRepoRoot(): Promise<string> {
  // Resolve from import.meta.url, handling Vite's /@fs/ prefix and URL mangling
  let modulePath: string
  try {
    const url = new URL(import.meta.url)
    modulePath = url.protocol === 'file:' ? url.pathname : import.meta.url
  } catch {
    modulePath = import.meta.url
  }
  // Strip Vite's /@fs/ prefix
  if (modulePath.startsWith('/@fs/')) modulePath = modulePath.slice(4)
  // On Windows, strip leading slash from /C:/...
  if (/^\/[A-Z]:/.test(modulePath)) modulePath = modulePath.slice(1)

  // Walk up from the module file to find the directory containing registry/
  let dir = path.dirname(path.resolve(modulePath))
  for (let i = 0; i < 10; i++) {
    try {
      const registryPath = path.join(dir, 'registry')
      const stat = await fs.stat(registryPath)
      if (stat.isDirectory()) return dir
    } catch { /* continue walking up */ }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  // Fallback: standard ../../ resolution
  return path.resolve(path.dirname(modulePath), '..', '..')
}

export async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`))
}

export async function removeDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true })
}

export function sanitizePackageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export function runTar(sourceDir: string, archivePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('tar', ['-czf', archivePath, '-C', sourceDir, '.'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

export async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const results: string[] = []

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }
      results.push(path.relative(rootDir, absolutePath))
    }
  }

  await walk(rootDir)
  return results.sort()
}
