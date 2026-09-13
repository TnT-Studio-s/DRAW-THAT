import { attachDatabasePool } from '@neon/functions'
import { Pool } from 'pg'

let pool: Pool | undefined

export function getDatabasePool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('database_required')
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
    attachDatabasePool(pool)
  }
  return pool
}
