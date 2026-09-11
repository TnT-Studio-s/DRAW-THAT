import { Pool } from 'pg'

export type EvidenceEvent = {
  sequence: number
  kind: 'stroke' | 'undo' | 'clear'
  data: Record<string, unknown>
}

export type EvidenceRecord = {
  sessionId: string
  turnId: string
  events: EvidenceEvent[]
  createdAt: string
  expiresAt: string
}

export interface EvidenceStore {
  append(sessionId: string, turnId: string, event: EvidenceEvent): Promise<void>
  retain(sessionId: string, turnId: string, retentionMs: number): Promise<void>
  get(sessionId: string, turnId: string): Promise<EvidenceRecord | null>
  remove(sessionId: string, turnId: string): Promise<void>
  purgeExpired(now?: Date): Promise<number>
  logAccess(staffSubject: string, sessionId: string, turnId: string): Promise<void>
}

const MAX_EVENTS_PER_TURN = 2048

export class MemoryEvidenceStore implements EvidenceStore {
  private readonly records = new Map<string, EvidenceRecord>()
  private readonly accessLog: Array<{ staffSubject: string; sessionId: string; turnId: string; accessedAt: string }> = []

  async append(sessionId: string, turnId: string, event: EvidenceEvent) {
    const key = `${sessionId}:${turnId}`
    const now = new Date()
    const current = this.records.get(key) ?? { sessionId, turnId, events: [], createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() }
    current.events.push({ sequence: event.sequence, kind: event.kind, data: structuredClone(event.data) })
    if (current.events.length > MAX_EVENTS_PER_TURN) current.events.shift()
    this.records.set(key, current)
  }

  async retain(sessionId: string, turnId: string, retentionMs: number) {
    const key = `${sessionId}:${turnId}`
    const now = Date.now()
    const current = this.records.get(key) ?? { sessionId, turnId, events: [], createdAt: new Date(now).toISOString(), expiresAt: new Date(now).toISOString() }
    current.expiresAt = new Date(Math.max(Date.parse(current.expiresAt), now + retentionMs)).toISOString()
    this.records.set(key, current)
  }

  async get(sessionId: string, turnId: string) {
    const record = this.records.get(`${sessionId}:${turnId}`)
    if (!record || Date.parse(record.expiresAt) <= Date.now()) return null
    return structuredClone(record)
  }

  async remove(sessionId: string, turnId: string) { this.records.delete(`${sessionId}:${turnId}`) }

  async purgeExpired(now = new Date()) {
    let deleted = 0
    for (const [key, record] of this.records) {
      if (Date.parse(record.expiresAt) <= now.getTime()) {
        this.records.delete(key)
        deleted += 1
      }
    }
    return deleted
  }

  async logAccess(staffSubject: string, sessionId: string, turnId: string) {
    this.accessLog.push({ staffSubject, sessionId, turnId, accessedAt: new Date().toISOString() })
    if (this.accessLog.length > 1000) this.accessLog.shift()
  }
}

class PostgresEvidenceStore implements EvidenceStore {
  constructor(private readonly pool: Pool) {}

  async append(sessionId: string, turnId: string, event: EvidenceEvent) {
    await this.pool.query(`INSERT INTO session_evidence (session_id, turn_id, sequence, event) VALUES ($1, $2, $3, $4) ON CONFLICT (session_id, turn_id, sequence) DO UPDATE SET event = EXCLUDED.event`, [sessionId, turnId, event.sequence, event])
    await this.pool.query(`DELETE FROM session_evidence WHERE session_id = $1 AND turn_id = $2 AND sequence < (SELECT GREATEST(COALESCE(MAX(sequence), 0) - $3 + 1, 0) FROM session_evidence WHERE session_id = $1 AND turn_id = $2)`, [sessionId, turnId, MAX_EVENTS_PER_TURN])
  }

  async retain(sessionId: string, turnId: string, retentionMs: number) {
    await this.pool.query(`UPDATE session_evidence SET expires_at = GREATEST(expires_at, now() + ($3::bigint * interval '1 millisecond')) WHERE session_id = $1 AND turn_id = $2`, [sessionId, turnId, retentionMs])
  }

  async get(sessionId: string, turnId: string) {
    const result = await this.pool.query<{ sequence: number; event: Record<string, unknown>; created_at: Date; expires_at: Date }>(`SELECT sequence, event, min(created_at) OVER () AS created_at, max(expires_at) OVER () AS expires_at FROM session_evidence WHERE session_id = $1 AND turn_id = $2 AND expires_at > now() ORDER BY sequence`, [sessionId, turnId])
    if (!result.rows.length) return null
    return { sessionId, turnId, events: result.rows.map((row) => ({ sequence: row.sequence, kind: (row.event.kind ?? 'stroke') as EvidenceEvent['kind'], data: row.event.data as Record<string, unknown> })), createdAt: new Date(result.rows[0].created_at).toISOString(), expiresAt: new Date(result.rows[0].expires_at).toISOString() }
  }

  async remove(sessionId: string, turnId: string) { await this.pool.query(`DELETE FROM session_evidence WHERE session_id = $1 AND turn_id = $2`, [sessionId, turnId]) }

  async purgeExpired(now = new Date()) {
    const result = await this.pool.query(`DELETE FROM session_evidence WHERE expires_at <= $1`, [now])
    return result.rowCount ?? 0
  }

  async logAccess(staffSubject: string, sessionId: string, turnId: string) {
    await this.pool.query(`INSERT INTO evidence_access_log (staff_subject, session_id, turn_id) VALUES ($1, $2, $3)`, [staffSubject, sessionId, turnId])
  }
}

let store: EvidenceStore | undefined
export function getEvidenceStore(): EvidenceStore {
  if (store) return store
  store = process.env.DATABASE_URL ? new PostgresEvidenceStore(new Pool({ connectionString: process.env.DATABASE_URL })) : new MemoryEvidenceStore()
  return store
}
