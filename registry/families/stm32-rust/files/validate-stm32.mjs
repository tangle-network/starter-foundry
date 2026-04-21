#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

for (const rel of ['Cargo.toml', 'memory.x', 'build.rs', 'Embed.toml', 'src/main.rs']) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}
const cargo = readFileSync(join(here, 'Cargo.toml'), 'utf8')
if (!/embassy-stm32/.test(cargo)) throw new Error('Cargo.toml missing embassy-stm32 dependency')
if (!/embassy-executor/.test(cargo)) throw new Error('Cargo.toml missing embassy-executor dependency')
const embed = readFileSync(join(here, 'Embed.toml'), 'utf8')
if (!/chip\s*=\s*"STM32/.test(embed)) throw new Error('Embed.toml missing chip = "STM32..."')
const memory = readFileSync(join(here, 'memory.x'), 'utf8')
if (!/FLASH\s+:\s+ORIGIN/.test(memory)) throw new Error('memory.x missing FLASH region')
if (!/RAM\s+:\s+ORIGIN/.test(memory)) throw new Error('memory.x missing RAM region')
console.log('stm32-rust starter ok')
