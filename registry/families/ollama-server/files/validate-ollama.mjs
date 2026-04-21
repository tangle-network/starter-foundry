#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

for (const rel of ['docker-compose.yml', 'Modelfile', 'README.md', 'package.json', 'src/client.ts']) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}

const compose = readFileSync(join(here, 'docker-compose.yml'), 'utf8')
if (!compose.includes('ollama/ollama')) throw new Error('docker-compose.yml does not reference ollama/ollama image')
if (!compose.includes('11434')) throw new Error('docker-compose.yml does not expose port 11434')

const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
if (!pkg.devDependencies?.tsx) throw new Error('tsx not in devDependencies')

console.log('ollama starter ok')
