import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[db] DATABASE_URL is required; no migration was run.')
  process.exit(2)
}

const migration = await readFile(path.resolve(process.cwd(), 'migrations/001_phase3_accounts.sql'), 'utf8')
const pool = new Pool({ connectionString: databaseUrl })
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  const applied = await pool.query(`SELECT 1 FROM schema_migrations WHERE version = $1`, ['001_phase3_accounts'])
  if (applied.rowCount) {
    console.log('[db] PASS: migrations/001_phase3_accounts.sql already applied')
  } else {
    await pool.query(migration)
    await pool.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, ['001_phase3_accounts'])
    console.log('[db] PASS: applied migrations/001_phase3_accounts.sql')
  }
} catch (error) {
  console.error(`[db] migration failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
