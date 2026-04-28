/**
 * `pnpm profiles list | show <name> | diff <a> <b>`
 *
 * CODEOWNERS-gated review tool — operators read this before approving a
 * profile change PR.
 */

import { diffProfiles, listProfileNames, loadProfile } from '../profile-loader.js'

export interface ProfilesCliOptions {
  sub: string
  args: string[]
  json: boolean
}

function loadOrFallback(name: string): ReturnType<typeof loadProfile> {
  try {
    return loadProfile(name)
  } catch {
    // If the snapshot lock is empty, fall back to skipSnapshotResolve so
    // operators can still inspect the profile chain pre-`--apply`.
    return loadProfile(name, { skipSnapshotResolve: true })
  }
}

export async function runProfiles(opts: ProfilesCliOptions): Promise<void> {
  switch (opts.sub) {
    case 'list': {
      const names = listProfileNames()
      if (opts.json) process.stdout.write(JSON.stringify(names, null, 2) + '\n')
      else for (const n of names) process.stdout.write(n + '\n')
      return
    }
    case 'show': {
      const name = opts.args[0]
      if (!name) throw new Error('usage: pnpm profiles show <name>')
      const profile = loadOrFallback(name)
      process.stdout.write(JSON.stringify(profile, null, 2) + '\n')
      return
    }
    case 'diff': {
      const a = opts.args[0]
      const b = opts.args[1]
      if (!a || !b) throw new Error('usage: pnpm profiles diff <a> <b>')
      const pa = loadOrFallback(a)
      const pb = loadOrFallback(b)
      const delta = diffProfiles(pa, pb)
      if (opts.json) {
        process.stdout.write(JSON.stringify({ a, b, delta }, null, 2) + '\n')
      } else if (delta.length === 0) {
        process.stdout.write(`profiles "${a}" and "${b}" are equivalent\n`)
      } else {
        process.stdout.write(`diff ${a} → ${b}:\n`)
        for (const d of delta) {
          process.stdout.write(`  ${d.field}: ${JSON.stringify(d.a)} → ${JSON.stringify(d.b)}\n`)
        }
      }
      return
    }
    default:
      throw new Error(`unknown profiles subcommand: "${opts.sub}" (expected list | show | diff)`)
  }
}
