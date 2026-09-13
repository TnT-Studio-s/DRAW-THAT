import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readdir } from 'node:fs/promises'
import process from 'node:process'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[db] DATABASE_URL is required; no migration was run.')
  process.exit(2)
}

const migrationDir = path.resolve(process.cwd(), 'migrations')
const migrationFiles = (await readdir(migrationDir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort()
const pool = new Pool({ connectionString: databaseUrl })
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  for (const file of migrationFiles) {
    const version = file.replace(/\.sql$/, '')
    const applied = await pool.query(`SELECT 1 FROM schema_migrations WHERE version = $1`, [version])
    if (applied.rowCount) {
      console.log(`[db] PASS: migrations/${file} already applied`)
      continue
    }
    await pool.query(await readFile(path.join(migrationDir, file), 'utf8'))
    await pool.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version])
    console.log(`[db] PASS: applied migrations/${file}`)
  }
} catch (error) {
  console.error(`[db] migration failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
