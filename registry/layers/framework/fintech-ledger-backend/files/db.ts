import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

// ── env ──────────────────────────────────────────────────────────────────────
const DATABASE_URL: string = process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/ledger'
// ─────────────────────────────────────────────────────────────────────────────

const client = postgres(DATABASE_URL, { ssl: 'prefer', max: 10 })
export const db = drizzle(client, { schema })
