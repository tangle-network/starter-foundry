import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.ts'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is required (postgres://user:pass@host/db)')
}

// ssl: 'require' is intentional — PHI in flight MUST be over TLS, even
// to a same-VPC Postgres. Downgrading this is a HIPAA compliance issue.
const client = postgres(url, { ssl: 'require', max: 10 })
export const db = drizzle(client, { schema })
